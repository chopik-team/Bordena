import "fake-indexeddb/auto"
import * as core from "@bordena/core"
import type { Card, Dashboard, AutomationRule } from "@bordena/contract"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { zipSync, strToU8 } from "fflate"
import { flushLinkedSync, requestLinkedSync } from "../linked-sync"
import { builtinTemplates } from "./changeset-schema"
import { webDb, BLOBS, BACKUPS, BordenaDB } from "../adapters/web-db"
import { LocalFiles } from "../adapters/local-files"
import { initializeWorkspace } from "../initialize"
import { installRuntime, initialLayout, updateCard, sync } from "@bordena/core"
import {
  ensureLayout,
  changeLayout,
  updateDashboard,
} from "../layout-workspace"
import {
  createWorkspace,
  createProject,
  moveBoardGroup,
  changeProject,
  readOrganization,
  placeBoardInGroup,
  archiveWorkspace,
  removeWorkspace,
} from "../workspaces"
import { setPreferences, preferencesSnapshot } from "../preferences"
import {
  type ImportPayload,
  encodeArchive,
  encodeJson,
  decodeImport,
  validateDocument,
  sha256,
  MAX_ARCHIVE_BYTES,
} from "./format"
import {
  exportWorkspace,
  previewImport,
  applyImport,
  createBackup,
  readBackup,
  listBackups,
} from "./workspace"
import {
  applyChangeset,
  undoChangeset,
  planChangeset,
  ChangesetSchema,
  applyOperations,
} from "./changeset"
import {
  installStructuralHistory,
  historyAction,
  resetStructuralHistory,
  commitPendingHistory,
} from "../structural-history"
import { pruneAutomaticBackups } from "./workspace"
import { deleteManagedAttachment } from "./workspace"
import { checkDeadlineNotifications } from "../deadline-notifications"
import { invoke } from "@tauri-apps/api/core"
import { calendarDefaults, eventDefaults } from "../calendar-data"
import { CalendarStateSchema, GENERAL_CALENDAR_ID } from "@bordena/contract"
import { freeLaneOperations } from "../free-lane-drop"
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

let tail = Promise.resolve()
beforeAll(() => {
  const kv = new Map<string, string>()
  installRuntime({
    db: webDb,
    kv: {
      get: (key) => kv.get(key) ?? null,
      set: (key, value) => {
        kv.set(key, value)
      },
      remove: (key) => {
        kv.delete(key)
      },
    },
    http: {
      isConfigured: () => false,
      subscribe: () => () => {},
      fetch: async () => {
        throw new Error("Offline")
      },
      url: (path) => path,
    },
    net: { online: () => false, subscribe: () => () => {} },
    foreground: { active: () => true, subscribe: () => () => {} },
    auth: { token: () => null, capture: () => {}, clear: () => {} },
    flushSync: (fn) => fn(),
  })
  sync.init()
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => {
        const result = tail.then(callback)
        tail = result.then(
          () => undefined,
          () => undefined
        )
        return result
      },
    },
  })
})
beforeEach(async () => {
  resetStructuralHistory()
  const db = await webDb.open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...db.objectStoreNames], "readwrite")
    for (const name of db.objectStoreNames) tx.objectStore(name).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  await initializeWorkspace()
  await webDb.bindEpoch()
})

describe("0.8.2 pending editor writes at data boundaries", () => {
  it.each(["export", "backup"])(
    "includes the last pending Markdown in %s",
    async (action) => {
      const original = await exportWorkspace(),
        card = original.document.boards[0].cards[0]
      const flush = vi
        .spyOn(core, "flushCardEdits")
        .mockImplementationOnce(async () => {
          await webDb.set("cards", card.id, {
            ...card,
            body: "# Последняя правка — не потерять",
          })
        })
      try {
        const payload =
          action === "export"
            ? await exportWorkspace()
            : await readBackup(await createBackup())
        expect(
          payload.document.boards
            .flatMap((b) => b.cards)
            .find((c) => c.id === card.id)?.body
        ).toBe("# Последняя правка — не потерять")
      } finally {
        flush.mockRestore()
      }
    }
  )
  it("rejects a restore preview when a pending edit becomes newer data", async () => {
    const original = await exportWorkspace(),
      expected = await previewImport(original),
      card = original.document.boards[0].cards[0]
    const flush = vi
      .spyOn(core, "flushCardEdits")
      .mockImplementationOnce(async () => {
        await webDb.set("cards", card.id, {
          ...card,
          body: "Не перезаписывать импортом",
        })
      })
    try {
      await expect(applyImport(original, "replace", expected)).rejects.toThrow(
        "Данные изменились после просмотра"
      )
      expect((await webDb.get<Card>("cards", card.id))?.body).toBe(
        "Не перезаписывать импортом"
      )
    } finally {
      flush.mockRestore()
    }
  })
})
describe("0.7 independent card appearance", () => {
  it("preserves card color and original text through priority changes and verified backup restore", async () => {
    const before = await exportWorkspace(),
      card = before.document.boards[0].cards[0]
    await updateCard(card.id, { color: "violet", priority: "high" })
    await updateCard(card.id, { priority: "low" })
    const copy = await decodeImport(
      await encodeArchive(await exportWorkspace())
    )
    expect(
      copy.document.boards[0].cards.find((c) => c.id === card.id)
    ).toMatchObject({
      color: "violet",
      priority: "low",
      body: card.body,
      deadline: card.deadline,
    })
    await updateCard(card.id, { color: "blue" })
    await applyImport(copy, "replace", await previewImport(copy))
    expect(
      (await exportWorkspace()).document.boards[0].cards.find(
        (c) => c.id === card.id
      )?.color
    ).toBe("violet")
  })
  it("applies color using the existing changeset without changing section appearance", async () => {
    const before = await exportWorkspace(),
      board = before.document.boards[0],
      card = board.cards[0]
    await applyOperations([
      {
        op: "update-card",
        id: card.id,
        expectedUpdatedAt: card.updatedAt,
        patch: { color: "green" },
      },
    ])
    const after = await exportWorkspace()
    expect(
      after.document.boards[0].cards.find((c) => c.id === card.id)?.color
    ).toBe("green")
    expect(after.document.boards[0].columns).toEqual(board.columns)
  })
})

describe("0.6 calendar atomic exchange and persistence", () => {
  const currentState = async () =>
    CalendarStateSchema.parse(await webDb.get("meta", "bordena:calendar"))
  async function setupCalendar() {
    await webDb.run("meta", "readwrite", (s) =>
      s.put(5, "bordena:model-revision")
    )
    const before = await exportWorkspace(),
      calendar = calendarDefaults("Work"),
      card = before.document.boards[0].cards[0]
    const event = {
      ...eventDefaults(
        calendar.id,
        new Date("2026-10-20T10:00:00Z"),
        "Session"
      ),
      kind: "block" as const,
      links: [{ type: "card" as const, id: card.id }],
    }
    await applyOperations([
      { op: "create-calendar", calendar },
      { op: "create-calendar-event", event },
    ])
    return { before, calendar, event, card }
  }
  it("writes a verified previous-format checkpoint before first calendar change, preserving all source objects", async () => {
    const { before } = await setupCalendar(),
      after = await exportWorkspace()
    expect(after.document.boards).toEqual(before.document.boards)
    expect(after.document.schemaVersion).toBe(6)
    expect(after.document.calendar?.events).toHaveLength(1)
    const backups = await listBackups()
    expect(backups.some((b) => b.kind === "checkpoint")).toBe(true)
    for (const b of backups)
      expect((await readBackup(b)).document.schemaVersion).toBeLessThanOrEqual(
        5
      )
  })
  it("preserves calendars, exceptions and availability through checked archive restore", async () => {
    const { event } = await setupCalendar(),
      state = await currentState(),
      saved = state.events[0]
    await applyOperations([
      {
        op: "update-calendar-event",
        id: event.id,
        expectedUpdatedAt: saved.updatedAt,
        event: {
          ...saved,
          recurrence: { frequency: "daily", interval: 1 },
          exceptions: { "2026-10-21": null },
        },
      },
      {
        op: "upsert-availability",
        expectedUpdatedAt: 0,
        profile: {
          id: "profile",
          title: "Night",
          color: "#7866d5",
          weekdays: [1, 2],
          dates: [],
          excludedDates: [],
          intervals: [{ start: 1320, end: 1560 }],
          breaks: [],
          updatedAt: 0,
        },
      },
    ])
    const exported = await exportWorkspace(),
      archive = await encodeArchive(exported),
      decoded = await decodeImport(archive)
    expect(decoded.document.calendar).toEqual(exported.document.calendar)
    await applyImport(decoded, "replace", await previewImport(decoded))
    await webDb.bindEpoch()
    expect((await exportWorkspace()).document.calendar).toEqual(
      exported.document.calendar
    )
  })
  it("rejects an invalid source, stale revision or reversed timestamp before any write", async () => {
    const { event } = await setupCalendar(),
      before = await exportWorkspace(),
      saved = (await currentState()).events[0]
    await expect(
      applyOperations([
        {
          op: "update-calendar-event",
          id: event.id,
          expectedUpdatedAt: saved.updatedAt,
          event: { ...saved, links: [{ type: "card", id: "missing" }] },
        },
      ])
    ).rejects.toThrow(/unavailable/)
    await expect(
      applyOperations([
        {
          op: "update-calendar-event",
          id: event.id,
          expectedUpdatedAt: 0,
          event: saved,
        },
      ])
    ).rejects.toThrow(/Stale/)
    await expect(
      applyOperations([
        {
          op: "update-calendar-event",
          id: event.id,
          expectedUpdatedAt: saved.updatedAt,
          event: { ...saved, end: "2020-01-01T00:00:00Z" },
        },
      ])
    ).rejects.toThrow()
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
    expect(await currentState()).toEqual(before.document.calendar)
  })
  it("round-trips board default calendar, card overrides and archived calendar metadata in v6", async () => {
    const { calendar } = await setupCalendar()
    const initial = await exportWorkspace(),
      board = initial.document.boards[0].dashboard
    await applyOperations([
      {
        op: "update-board",
        id: board.id,
        expectedUpdatedAt: board.updatedAt,
        patch: { defaultCalendarId: calendar.id },
      },
    ])
    const exported = await exportWorkspace()
    expect(exported.document.schemaVersion).toBe(6)
    expect(exported.document.boards[0].dashboard.defaultCalendarId).toBe(
      calendar.id
    )
    const decoded = await decodeImport(await encodeArchive(exported))
    expect(decoded.document).toEqual(exported.document)
    await applyImport(decoded, "replace", await previewImport(decoded))
    await webDb.bindEpoch()
    const restored = await exportWorkspace()
    expect(restored.document.boards).toEqual(exported.document.boards)
    expect(restored.document.calendar).toEqual(exported.document.calendar)
  })
  it("deduplicates external calendar Changesets and detects changed-content replay", async () => {
    const calendar = calendarDefaults("Work"),
      input = {
        format: "bordena-changeset",
        schemaVersion: 1,
        id: "calendar-command",
        operations: [{ op: "create-calendar", calendar }],
      }
    expect((await applyChangeset(input)).status).toBe("applied")
    expect((await applyChangeset(input)).status).toBe("duplicate")
    await expect(
      applyChangeset({ ...input, title: "Different" })
    ).rejects.toThrow(/reused/)
    expect((await currentState()).calendars).toHaveLength(1)
  })
  it("cancels one instance without cancelling the series and rolls it back safely", async () => {
    const { event } = await setupCalendar(),
      saved = (await currentState()).events[0]
    await applyOperations([
      {
        op: "update-calendar-event",
        id: event.id,
        expectedUpdatedAt: saved.updatedAt,
        event: { ...saved, recurrence: { frequency: "daily", interval: 1 } },
      },
    ])
    const recurring = (await currentState()).events[0]
    await applyOperations([
      {
        op: "cancel-calendar-event",
        id: event.id,
        expectedUpdatedAt: recurring.updatedAt,
        instance: "2026-10-21",
      },
    ])
    expect((await currentState()).events[0].status).toBe("planned")
    expect(
      (await currentState()).events[0].exceptions?.["2026-10-21"]
    ).toBeNull()
    await historyAction("undo")
    expect(
      (await currentState()).events[0].exceptions?.["2026-10-21"]
    ).toBeUndefined()
  })
  it("keeps manual calendars completely inactive when opening or saving a card", async () => {
    await setupCalendar()
    const before = await currentState()
    requestLinkedSync()
    await flushLinkedSync()
    expect(await currentState()).toEqual(before)
  })
  it("exports and backs up scheduling history, then accepts further commands", async () => {
    const { calendar, event } = await setupCalendar(),
      state = await currentState(),
      cal = state.calendars[0],
      saved = state.events[0],
      now = Date.now()
    await applyOperations([
      {
        op: "upsert-availability",
        expectedUpdatedAt: 0,
        profile: {
          id: "auto-profile",
          title: "Any time",
          color: "#7866d5",
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          dates: [],
          excludedDates: [],
          intervals: [{ start: 0, end: 1440 }],
          breaks: [],
          updatedAt: 0,
        },
      },
      {
        op: "update-calendar",
        id: calendar.id,
        expectedUpdatedAt: cal.updatedAt,
        calendar: { ...cal, profileId: "auto-profile", reschedule: "smart" },
      },
      {
        op: "update-calendar-event",
        id: event.id,
        expectedUpdatedAt: saved.updatedAt,
        event: {
          ...saved,
          flexible: true,
          start: new Date(now - 3600000).toISOString(),
          end: new Date(now - 1800000).toISOString(),
        },
      },
    ])
    requestLinkedSync()
    await flushLinkedSync()
    const exported = await exportWorkspace()
    expect(
      exported.document.workspace?.history.some((h) => h.boardId === "calendar")
    ).toBe(true)
    const backup = await createBackup()
    expect((await readBackup(backup)).document.calendar).toEqual(
      exported.document.calendar
    )
    const moved = (await currentState()).events[0]
    await applyOperations([
      {
        op: "update-calendar-event",
        id: moved.id,
        expectedUpdatedAt: moved.updatedAt,
        event: { ...moved, title: "After scheduling" },
      },
    ])
    expect((await currentState()).events[0].title).toBe("After scheduling")
  })
  it("undoes calendar edits without replacing other windows epoch or later Markdown", async () => {
    const { event, card } = await setupCalendar(),
      state = await currentState(),
      epoch = await webDb.get("meta", "bordena:epoch"),
      saved = state.events[0]
    await applyOperations([
      {
        op: "update-calendar-event",
        id: event.id,
        expectedUpdatedAt: saved.updatedAt,
        event: { ...saved, title: "Changed" },
      },
    ])
    await updateCard(card.id, { body: "A later independent note" })
    await historyAction("undo")
    expect((await currentState()).events[0].title).toBe("Session")
    expect((await webDb.get<Card>("cards", card.id))?.body).toBe(
      "A later independent note"
    )
    expect(await webDb.get("meta", "bordena:epoch")).toBe(epoch)
  })
  it("rejects an additive import with colliding calendar IDs atomically", async () => {
    await setupCalendar()
    const snapshot = await exportWorkspace()
    const onlyCalendar = {
      ...snapshot,
      document: {
        ...snapshot.document,
        boards: [],
        workspace: { history: [] },
      },
    }
    await expect(
      applyImport(onlyCalendar, "add", await previewImport(onlyCalendar))
    ).rejects.toThrow()
    expect((await exportWorkspace()).document.calendar).toEqual(
      snapshot.document.calendar
    )
  })
  it("creates a general event atomically without a manually created calendar", async () => {
    const event = eventDefaults(
      GENERAL_CALENDAR_ID,
      new Date("2099-01-01T10:00Z"),
      "General event"
    )
    await applyOperations([{ op: "create-calendar-event", event }])
    const after = (await exportWorkspace()).document
    expect(after.schemaVersion).toBe(6)
    expect(
      after.calendar?.calendars.filter((c) => c.id === GENERAL_CALENDAR_ID)
    ).toHaveLength(1)
    expect(after.calendar?.events[0].calendarId).toBe(GENERAL_CALENDAR_ID)
    const card = after.boards.flatMap((b) => b.cards)[0]
    await updateCard(card.id, { calendarId: GENERAL_CALENDAR_ID })
    const exported = await exportWorkspace()
    expect(
      validateDocument(
        JSON.parse(new TextDecoder().decode(encodeJson(exported.document)))
      )
        .boards.flatMap((b) => b.cards)
        .find((c) => c.id === card.id)?.calendarId
    ).toBe(GENERAL_CALENDAR_ID)
    const general = after.calendar!.calendars[0]
    await expect(
      applyOperations([
        {
          op: "update-calendar",
          id: general.id,
          expectedUpdatedAt: general.updatedAt,
          calendar: { ...general, deletedAt: Date.now() },
        },
      ])
    ).rejects.toThrow()
  })
  it("creates one section for an empty lane and moves the original card in the same batch", async () => {
    const first = (await exportWorkspace()).document.boards[0]
    await ensureLayout(first.dashboard.id, "free")
    await applyOperations([
      {
        op: "create-axis",
        id: "empty-lane",
        boardId: first.dashboard.id,
        axis: "lanes",
        title: "Empty",
      },
    ])
    const b = (await exportWorkspace()).document.boards.find(
        (b) => b.dashboard.id === first.dashboard.id
      )!,
      card = b.cards[0]
    await applyOperations(
      freeLaneOperations(
        b.dashboard,
        b.columns,
        card,
        "empty-lane",
        "auto-section"
      )
    )
    const after = (await exportWorkspace()).document.boards.find(
      (x) => x.dashboard.id === b.dashboard.id
    )!
    expect(after.cards.find((c) => c.id === card.id)?.columnId).toBe(
      "auto-section"
    )
    expect(after.dashboard.layout?.sections["auto-section"].laneId).toBe(
      "empty-lane"
    )
    const moved = after.cards.find((c) => c.id === card.id)!
    expect(moved.attachments).toEqual(card.attachments)
    const again = freeLaneOperations(
      after.dashboard,
      after.columns,
      moved,
      "empty-lane",
      "must-not-create"
    )
    expect(again.map((o) => o.op)).toEqual(["move-card"])
    expect(() =>
      freeLaneOperations(after.dashboard, after.columns, moved, "missing")
    ).toThrow()
  })
  it("remains compatible with a v5 document without calendar data", async () => {
    const before = await exportWorkspace()
    expect(before.document.schemaVersion).toBe(5)
    expect(
      validateDocument({ ...before.document, schemaVersion: 5 }).calendar
    ).toBeUndefined()
  })
})

describe("0.4 structural history and backup slots", () => {
  it("rejects a stale inline date edit atomically without overwriting newer Markdown", async () => {
    const card = (await exportWorkspace()).document.boards[0].cards[0]
    await updateCard(card.id, { body: "Новая заметка" })
    await expect(
      updateCard(card.id, { body: "Устаревшая дата" }, { body: card.body })
    ).rejects.toThrow(/Текст изменился/)
    expect((await webDb.get<Card>("cards", card.id))?.body).toBe(
      "Новая заметка"
    )
  })
  let stopHistory: (() => void) | undefined
  afterEach(() => {
    stopHistory?.()
    stopHistory = undefined
    resetStructuralHistory()
    setPreferences({ automaticBackups: 3 })
  })
  it("applies a small UI command without replacing the epoch or blobs and undoes it over a later body edit", async () => {
    const board = (await exportWorkspace()).document.boards[0],
      card = board.cards[0]
    const epoch = await webDb.get("meta", "bordena:epoch")
    await applyOperations([
      {
        op: "update-board",
        id: board.dashboard.id,
        expectedUpdatedAt: board.dashboard.updatedAt,
        patch: { color: "blue" },
      },
    ])
    expect(await webDb.get("meta", "bordena:epoch")).toEqual(epoch)
    expect(await listBackups()).toHaveLength(0)
    expect(
      (await exportWorkspace()).document.extensions?.appliedChangesets
    ).toBeUndefined()
    await updateCard(card.id, { body: "Более поздний текст" })
    expect(await historyAction("undo")).toBe(true)
    expect(
      (await exportWorkspace()).document.boards[0].dashboard.color
    ).toBeUndefined()
    expect((await webDb.get<Card>("cards", card.id))?.body).toBe(
      "Более поздний текст"
    )
  })
  it("undoes and redoes structural fields while preserving subsequent body edits", async () => {
    const card = (await exportWorkspace()).document.boards[0].cards[0]
    stopHistory = installStructuralHistory()
    await updateCard(card.id, { title: "Renamed", progress: 42 })
    commitPendingHistory()
    await updateCard(card.id, { body: "A later Markdown edit ё" })
    expect(await historyAction("undo")).toBe(true)
    expect(await webDb.get<Card>("cards", card.id)).toMatchObject({
      title: card.title,
      body: "A later Markdown edit ё",
    })
    expect(await historyAction("redo")).toBe(true)
    expect(await webDb.get<Card>("cards", card.id)).toMatchObject({
      title: "Renamed",
      progress: 42,
      body: "A later Markdown edit ё",
    })
  })
  it("rejects a journal conflict without partial writes", async () => {
    const cards = (await exportWorkspace()).document.boards[0].cards
    stopHistory = installStructuralHistory()
    await updateCard(cards[0].id, { title: "First" })
    await updateCard(cards[1].id, { title: "Second" })
    commitPendingHistory()
    stopHistory()
    stopHistory = undefined
    await updateCard(cards[1].id, { title: "Concurrent" })
    await expect(historyAction("undo")).rejects.toThrow(/conflict/)
    expect((await webDb.get<Card>("cards", cards[0].id))?.title).toBe("First")
    expect((await webDb.get<Card>("cards", cards[1].id))?.title).toBe(
      "Concurrent"
    )
  })
  it("undoes and redoes a complete Changeset through the same journal", async () => {
    const before = (await exportWorkspace()).document.boards.length
    await applyChangeset({
      format: "bordena-changeset",
      schemaVersion: 1,
      id: "journal-batch",
      operations: [
        { op: "create-board", id: "journal-board", title: "Journal" },
      ],
    })
    expect(await historyAction("undo")).toBe(true)
    expect((await exportWorkspace()).document.boards).toHaveLength(before)
    expect(await historyAction("redo")).toBe(true)
    expect((await exportWorkspace()).document.boards).toHaveLength(before + 1)
  })
  it("limits automatic slots and retains manual/legacy copies including limit zero", async () => {
    const manual = await createBackup("manual", "Manual test")
    await createBackup("automatic", "One")
    await createBackup("automatic", "Two")
    await createBackup("automatic", "Three")
    setPreferences({ automaticBackups: 1 })
    await pruneAutomaticBackups()
    let records = await listBackups()
    expect(records.filter((r) => r.kind === "automatic")).toHaveLength(1)
    expect(records.some((r) => r.id === manual.id)).toBe(true)
    await readBackup(records[0])
    setPreferences({ automaticBackups: 0 })
    await pruneAutomaticBackups()
    records = await listBackups()
    expect(records.some((r) => r.kind === "automatic")).toBe(false)
    expect(records.some((r) => r.id === manual.id)).toBe(true)
  })
})

describe("0.4 one-time model checkpoint", () => {
  it("backs up a legacy profile before its first board edit and retains a readable v3 copy", async () => {
    await webDb.set("meta", "bordena:model-revision", 3)
    const before = await exportWorkspace(),
      board = before.document.boards[0]
    await updateDashboard(board.dashboard.id, (value) => ({
      ...value,
      color: "blue",
    }))
    const copies = await listBackups()
    expect(copies).toHaveLength(1)
    expect(copies[0].kind).toBe("checkpoint")
    const backup = await readBackup(copies[0])
    expect(backup.document.schemaVersion).toBe(3)
    expect(backup.document.boards).toEqual(before.document.boards)
    await updateCard(board.cards[0].id, { progress: 12 })
    expect(await listBackups()).toHaveLength(1)
    expect(await webDb.get("meta", "bordena:model-revision")).toBe(6)
  })
  it("refuses the first legacy edit if the protective copy cannot be persisted", async () => {
    await webDb.set("meta", "bordena:model-revision", 3)
    const before = await exportWorkspace(),
      board = before.document.boards[0]
    const fail = vi
      .spyOn(webDb, "run")
      .mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"))
    try {
      await expect(
        updateDashboard(board.dashboard.id, (value) => ({
          ...value,
          color: "blue",
        }))
      ).rejects.toThrow(/Quota/)
    } finally {
      fail.mockRestore()
    }
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
    expect(await webDb.get("meta", "bordena:model-revision")).toBe(3)
  })
})

describe("0.4 optional deadline notifications", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
    setPreferences({ windowsNotifications: false })
  })
  afterEach(() => setPreferences({ windowsNotifications: false }))
  it("does not notify closed matrix tasks and notifies after explicitly reopening them", async () => {
    const board = (await exportWorkspace()).document.boards[0],
      card = board.cards[0]
    await ensureLayout(board.dashboard.id, "matrix")
    await changeLayout(board.dashboard.id, (layout) => ({
      ...layout,
      states: [
        ...layout.states,
        { id: "closed", title: "Готово", done: true },
        { id: "frozen", title: "Ожидание", done: false },
      ],
    }))
    await updateCard(card.id, {
      deadline: "2020-01-01T12:00",
      stateId: "closed",
    })
    setPreferences({ windowsNotifications: true })
    expect(await checkDeadlineNotifications()).toBe(0)
    await updateCard(card.id, { stateId: "frozen" })
    expect(await checkDeadlineNotifications()).toBe(1)
  })
  it("defaults to off and sends once per deadline across repeated checks", async () => {
    const card = (await exportWorkspace()).document.boards[0].cards[0]
    await updateCard(card.id, { deadline: "2026-01-01T12:00" })
    const now = new Date("2026-10-18T18:00").getTime()
    expect(await checkDeadlineNotifications(now)).toBe(0)
    expect(invoke).not.toHaveBeenCalled()
    setPreferences({ windowsNotifications: true })
    expect(await checkDeadlineNotifications(now)).toBe(1)
    expect(await checkDeadlineNotifications(now)).toBe(0)
    await webDb.bindEpoch()
    expect(await checkDeadlineNotifications(now)).toBe(0)
    expect(invoke).toHaveBeenCalledTimes(1)
    await updateCard(card.id, { deadline: "2026-02-01T12:00" })
    expect(await checkDeadlineNotifications(now)).toBe(1)
  })
  it("ignores future, completed and undated tasks", async () => {
    const board = (await exportWorkspace()).document.boards[0],
      card = board.cards[0]
    setPreferences({ windowsNotifications: true })
    await updateCard(card.id, { deadline: "2099-12-19" })
    expect(await checkDeadlineNotifications()).toBe(0)
    await updateCard(card.id, { deadline: "2020-01-01" })
    await webDb.update<import("@bordena/contract").Column>(
      "columns",
      card.columnId,
      (column) => ({ ...column!, done: true })
    )
    expect(await checkDeadlineNotifications()).toBe(0)
    expect(invoke).not.toHaveBeenCalled()
  })
  it("includes project deadlines and does not loop after a Windows rejection", async () => {
    const project = await createProject("Video deadline", "default")
    await changeProject(project, { deadline: "2020-01-01" })
    setPreferences({ windowsNotifications: true })
    vi.mocked(invoke).mockRejectedValueOnce(
      new Error("Windows did not accept the notification")
    )
    await expect(checkDeadlineNotifications()).rejects.toThrow(/Windows/)
    expect(await checkDeadlineNotifications()).toBe(0)
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})

describe("0.4 changesets", () => {
  const batch = (operations: unknown[], id = "batch-test") => ({
    format: "bordena-changeset",
    schemaVersion: 1,
    id,
    operations,
  })
  const creation = () =>
    batch([
      { op: "create-workspace", id: "new-space", title: "CHOPIK" },
      {
        op: "create-project",
        id: "new-project",
        title: "Видеопроекты",
        workspaceId: "new-space",
      },
      {
        op: "create-board",
        id: "new-board",
        title: "FIFA 23",
        workspaceId: "new-space",
        projectId: "new-project",
      },
      {
        op: "create-section",
        id: "new-section",
        boardId: "new-board",
        title: "Работа",
      },
      {
        op: "create-card",
        id: "new-card",
        columnId: "new-section",
        title: "Сценарий",
        body: "# ё\n- [ ] Монтаж",
        deadline: "2026-12-19T17:40:00+03:00",
      },
    ])
  it("aborts all command writes after a synchronous storage error", async () => {
    const before = await exportWorkspace(),
      cards = before.document.boards[0].cards
    const store = (await webDb.open())
        .transaction("cards")
        .objectStore("cards"),
      proto = Object.getPrototypeOf(store) as IDBObjectStore,
      originalPut = proto.put
    const fail = vi.spyOn(proto, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey
    ) {
      if (this.name === "cards" && key === cards[1].id)
        throw new DOMException("Injected storage failure", "QuotaExceededError")
      return originalPut.call(this, value, key)
    })
    try {
      await expect(
        applyChangeset(
          batch(
            cards.slice(0, 2).map((c) => ({
              op: "update-card",
              id: c.id,
              expectedUpdatedAt: c.updatedAt,
              patch: { title: "Must roll back" },
            }))
          )
        )
      ).rejects.toThrow(/Injected/)
    } finally {
      fail.mockRestore()
    }
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
    expect(
      (await exportWorkspace()).document.extensions?.appliedChangesets
    ).toBeUndefined()
    expect(await listBackups()).toHaveLength(1)
  })
  it("creates a project atomically, persists stable IDs and rejects repeated IDs with altered content", async () => {
    expect(await applyChangeset(creation())).toMatchObject({
      status: "applied",
      operations: 5,
    })
    expect(await applyChangeset(creation())).toEqual({
      status: "duplicate",
      operations: 0,
    })
    expect(
      (await webDb.getAll("cards")).filter(
        (c: unknown) => (c as { id: string }).id === "new-card"
      )
    ).toHaveLength(1)
    const changed = creation()
    changed.operations[0] = {
      op: "create-workspace",
      id: "different-space",
      title: "Other",
    }
    await expect(applyChangeset(changed)).rejects.toThrow(/reused/)
  })
  it("undoes an entire batch and preserves its backup", async () => {
    const before = await exportWorkspace()
    await applyChangeset(creation())
    await undoChangeset()
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
    expect((await listBackups()).length).toBeGreaterThanOrEqual(2)
  })
  it("does not undo over a later manual edit", async () => {
    await applyChangeset(creation())
    await updateCard("new-card", { title: "More recent" })
    await expect(undoChangeset()).rejects.toThrow(/changed/)
    expect((await webDb.get<Card>("cards", "new-card"))?.title).toBe(
      "More recent"
    )
  })
  it("rejects an unknown operation and partly damaged file without writes or backup", async () => {
    const before = await exportWorkspace(),
      backups = (await listBackups()).length
    await expect(
      applyChangeset(
        batch([
          ...creation().operations,
          { op: "shell", command: "powershell" },
        ])
      )
    ).rejects.toThrow()
    await expect(
      applyChangeset(batch([{ op: "create-board", id: "bad", title: 3 }]))
    ).rejects.toThrow()
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
    expect((await listBackups()).length).toBe(backups)
  })
  it("rejects stale revisions, conflicts and unknown references before any writes", async () => {
    const before = await exportWorkspace(),
      card = before.document.boards[0].cards[0]
    await expect(
      applyChangeset(
        batch([
          {
            op: "update-card",
            id: card.id,
            expectedUpdatedAt: card.updatedAt - 1,
            patch: { title: "stale" },
          },
        ])
      )
    ).rejects.toThrow(/revision/)
    await expect(
      applyChangeset(
        batch([
          {
            op: "create-card",
            id: card.id,
            columnId: card.columnId,
            title: "duplicate",
          },
        ])
      )
    ).rejects.toThrow(/conflict/)
    await expect(
      applyChangeset(
        batch([
          {
            op: "create-card",
            id: "bad-card",
            columnId: "absent",
            title: "bad",
          },
        ])
      )
    ).rejects.toThrow(/unavailable/)
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
  })
  it("supports linking entities created in the same file, with expectedUpdatedAt 0", async () => {
    const change = creation()
    ;(change.operations as unknown[]).push(
      { op: "create-board", id: "child-board", title: "Производство" },
      {
        op: "link-board",
        id: "new-card",
        expectedUpdatedAt: 0,
        link: {
          schemaVersion: 1,
          boardId: "child-board",
          mode: "navigation",
          source: { type: "tasks" },
          rules: [],
          requireFullCoverage: true,
        },
      }
    )
    await applyChangeset(change)
    expect(
      (await webDb.get<Card>("cards", "new-card"))?.boardLink?.boardId
    ).toBe("child-board")
  })
  it("rejects cycles and preserves old Markdown/files when a batch fails", async () => {
    const before = await exportWorkspace(),
      board = before.document.boards[0],
      card = board.cards[0]
    await expect(
      applyChangeset(
        batch([
          {
            op: "link-board",
            id: card.id,
            expectedUpdatedAt: card.updatedAt,
            link: {
              schemaVersion: 1,
              boardId: board.dashboard.id,
              mode: "navigation",
              source: { type: "tasks" },
            },
          },
        ])
      )
    ).rejects.toThrow(/Cyclic/)
    expect((await exportWorkspace()).document).toMatchObject({
      boards: before.document.boards,
    })
  })
  it("generates new template IDs without copying private files, history or board links", async () => {
    const original = await exportWorkspace(),
      changes = batch([
        { op: "create-board", id: "template-one", title: "One" },
        {
          op: "apply-template",
          boardId: "template-one",
          templateId: "builtin-video",
        },
        { op: "create-board", id: "template-two", title: "Two" },
        {
          op: "apply-template",
          boardId: "template-two",
          templateId: "builtin-video",
        },
      ])
    const planned = planChangeset(original.document, changes)
    const a = planned.boards.find((b) => b.dashboard.id === "template-one")!,
      b = planned.boards.find((b) => b.dashboard.id === "template-two")!
    expect(a.cards).toHaveLength(0)
    expect(a.columns).toHaveLength(5)
    expect(
      a.columns.some((c) => b.columns.some((other) => other.id === c.id))
    ).toBe(false)
    expect(planned.workspace?.history).toEqual(
      original.document.workspace?.history
    )
  })
  it("stores mirrors independently, keeps one original card and survives exchange", async () => {
    const original = await exportWorkspace(),
      board = original.document.boards[0],
      card = board.cards[0]
    await applyChangeset(
      batch([
        {
          op: "create-mirror",
          boardId: board.dashboard.id,
          mirror: {
            id: "mirror-test",
            sourceCardId: card.id,
            columnId: card.columnId,
            position: "a0",
          },
        },
      ])
    )
    const after = await exportWorkspace()
    expect(after.document.boards.flatMap((b) => b.cards).length).toBe(
      original.document.boards.flatMap((b) => b.cards).length
    )
    const decoded = await decodeImport(await encodeArchive(after))
    expect(decoded.document.boards[0].dashboard.mirrors?.[0].sourceCardId).toBe(
      card.id
    )
  })
  it("exposes a strict machine-readable schema", () => {
    expect(
      ChangesetSchema.safeParse({ ...creation(), execute: "bad" }).success
    ).toBe(false)
  })
  it("does not apply creation defaults to omitted patch fields", async () => {
    const payload = await exportWorkspace(),
      board = payload.document.boards[0],
      card = board.cards[0],
      column = board.columns[0]
    card.priority = "high"
    card.tags = ["keep"]
    card.deadline = "2026-12-19"
    card.progress = 37
    column.color = "blue"
    column.done = true
    column.collapsed = true
    const planned = planChangeset(
      payload.document,
      batch([
        {
          op: "update-card",
          id: card.id,
          expectedUpdatedAt: card.updatedAt,
          patch: { title: "Rename only" },
        },
        {
          op: "update-section",
          id: column.id,
          expectedUpdatedAt: column.updatedAt,
          patch: { title: "Section rename only" },
        },
      ])
    )
    expect(planned.boards[0].cards[0]).toMatchObject({
      priority: "high",
      tags: ["keep"],
      deadline: "2026-12-19",
      progress: 37,
      title: "Rename only",
    })
    expect(planned.boards[0].columns[0]).toMatchObject({
      color: "blue",
      done: true,
      collapsed: true,
      title: "Section rename only",
    })
  })
  it("preserves and remaps a custom multi-lane template without old entity IDs", async () => {
    const original = (await exportWorkspace()).document,
      source = original.boards[0]
    source.dashboard.layout = initialLayout(source.columns, "free")
    const template = {
      id: "custom-layout",
      title: "Работа",
      category: "Пользовательские",
      mode: "free",
      layout: source.dashboard.layout,
      sections: source.columns.map((c) => ({
        sourceId: c.id,
        title: c.title,
        color: c.color,
        done: c.done,
        progressMode: "manual",
      })),
      fields: [],
      examples: [],
    }
    const planned = planChangeset(
      original,
      batch([
        { op: "save-template", template },
        { op: "create-board", id: "custom-instance", title: "Instance" },
        {
          op: "apply-template",
          boardId: "custom-instance",
          templateId: template.id,
        },
      ])
    )
    const instance = planned.boards.find(
      (b) => b.dashboard.id === "custom-instance"
    )!
    expect(instance.dashboard.layout?.lanes).toHaveLength(
      source.dashboard.layout.lanes.length
    )
    expect(
      instance.dashboard.layout?.lanes.some((l) =>
        source.dashboard.layout!.lanes.some((old) => old.id === l.id)
      )
    ).toBe(false)
    expect(Object.keys(instance.dashboard.layout!.sections)).toEqual(
      instance.columns.map((c) => c.id)
    )
    expect(instance.cards).toHaveLength(0)
  })
  it("supports axis creation, section configuration and project metadata in one batch", async () => {
    await applyChangeset(creation())
    const document = (await exportWorkspace()).document,
      sidebarRevision = document.workspace!.sidebar!.updatedAt,
      newBoard = document.boards.find(
        (b) => b.dashboard.id === "new-board"
      )!.dashboard
    await applyChangeset(
      batch(
        [
          {
            op: "create-axis",
            boardId: newBoard.id,
            id: "new-lane",
            axis: "lanes",
            title: "Дополнительно",
          },
          {
            op: "configure-section",
            boardId: newBoard.id,
            id: "new-section",
            expectedUpdatedAt: newBoard.updatedAt,
            patch: {
              laneId: "new-lane",
              position: "a2",
              progressMode: "manual",
            },
          },
          {
            op: "update-project",
            id: "new-project",
            expectedUpdatedAt: sidebarRevision,
            patch: {
              deadline: "2026-12-19T17:40",
              priority: "high",
              color: "blue",
            },
          },
        ],
        "axis-batch"
      )
    )
    const after = (await exportWorkspace()).document
    expect(
      after.boards.find((b) => b.dashboard.id === newBoard.id)?.dashboard.layout
        ?.sections["new-section"]
    ).toMatchObject({
      laneId: "new-lane",
      position: "a2",
      progressMode: "manual",
    })
    expect(
      after.workspace?.sidebar?.items.find((i) => i.id === "new-project")
    ).toMatchObject({ priority: "high", deadline: "2026-12-19T17:40" })
  })
  it("serializes simultaneous conflicting links and rejects one cycle before commit", async () => {
    const first = (await exportWorkspace()).document.boards[0]
    await applyChangeset(
      batch([
        { op: "create-board", id: "second-board", title: "Second" },
        {
          op: "create-section",
          id: "second-section",
          boardId: "second-board",
          title: "Work",
        },
        {
          op: "create-card",
          id: "second-card",
          columnId: "second-section",
          title: "Card",
        },
      ])
    )
    const makeLink = (boardId: string) => ({
      schemaVersion: 1 as const,
      boardId,
      mode: "navigation" as const,
      source: { type: "tasks" as const },
      rules: [],
      requireFullCoverage: true,
    })
    const results = await Promise.allSettled([
      updateCard(first.cards[0].id, { boardLink: makeLink("second-board") }),
      updateCard("second-card", { boardLink: makeLink(first.dashboard.id) }),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1)
    await exportWorkspace()
  })
  it("rejects invalid property/axis writes inside the actual IDB transaction", async () => {
    const source = (await exportWorkspace()).document.boards[0],
      card = source.cards[0]
    await updateDashboard(source.dashboard.id, (b) => ({
      ...b,
      layout: initialLayout(source.columns, "matrix"),
      fieldDefinitions: [{ id: "score", title: "Score", type: "percent" }],
    }))
    await expect(updateCard(card.id, { stageId: "absent" })).rejects.toThrow()
    await expect(
      updateCard(card.id, { fieldValues: { score: 999 } })
    ).rejects.toThrow()
    expect(await webDb.get("cards", card.id)).toEqual(card)
  })
  it("deletes managed metadata and bytes together while retaining a verified recovery copy", async () => {
    const card = (await exportWorkspace()).document.boards[0].cards[0]
    const stored = await new LocalFiles().put(card.id, {
        name: "test.wav",
        mime: "audio/wav",
        bytes: new Blob(["managed bytes"]),
      }),
      attachment = { ...stored, id: "delete-file", name: "test.wav" }
    await updateCard(card.id, { attachments: [attachment] })
    await deleteManagedAttachment(card.id, attachment.id)
    expect((await webDb.get<Card>("cards", card.id))?.attachments).toEqual([])
    await expect(
      new LocalFiles().get(card.id, attachment.key)
    ).rejects.toThrow()
    const backup = await readBackup((await listBackups())[0])
    expect(backup.document.boards[0].cards[0].attachments[0].id).toBe(
      attachment.id
    )
  })
})

describe("Bordena JSON and ZIP", () => {
  it("restores a legacy workspace without leaving the UI pointed at a removed workspace", async () => {
    const payload = await exportWorkspace()
    delete payload.document.preferences
    payload.document.schemaVersion = 2
    const obsolete = await createWorkspace("До восстановления")
    setPreferences({ workspaceId: obsolete })
    await applyImport(payload, "replace", await previewImport(payload))
    expect(preferencesSnapshot().workspaceId).toBe("default")
  })
  it("rejects orphan workspace references, duplicate project IDs and invalid section positions before writing", async () => {
    const payload = await exportWorkspace(),
      before = structuredClone(payload.document)
    payload.document.boards[0].dashboard.workspaceId = "missing-space"
    expect(() => validateDocument(payload.document)).toThrow()
    payload.document = structuredClone(before)
    payload.document.workspace!.sidebar = {
      id: "layout",
      items: [
        { type: "folder", id: "repeat-folder", title: "A", boardIds: [] },
        { type: "folder", id: "repeat-folder", title: "B", boardIds: [] },
      ],
      updatedAt: 0,
      deletedAt: null,
    }
    expect(() => validateDocument(payload.document)).toThrow()
    payload.document = structuredClone(before)
    const board = payload.document.boards[0]
    board.dashboard.layout = initialLayout(board.columns, "free")
    board.dashboard.layout.sections[board.columns[0].id].position =
      "broken-rank"
    expect(() => validateDocument(payload.document)).toThrow()
    expect((await exportWorkspace()).document.boards).toEqual(before.boards)
  })
  it("archives and removes workspace containers while retaining every card and project", async () => {
    const before = await exportWorkspace(),
      space = await createWorkspace("Студия"),
      project = await createProject("Фильм", space),
      board = before.document.boards[0].dashboard.id
    await moveBoardGroup(board, space, project)
    await archiveWorkspace(space, true)
    expect(
      (await exportWorkspace()).document.organization?.workspaces.find(
        (w) => w.id === space
      )?.archived
    ).toBe(true)
    await removeWorkspace(space, "default")
    const state = await readOrganization()
    expect(state.sidebar.workspaces?.some((w) => w.id === space)).toBe(false)
    expect(
      state.sidebar.items.find((item) => item.id === project)
    ).toMatchObject({ workspaceId: "default", boardIds: [board] })
    expect(state.dashboards.find((b) => b.id === board)?.workspaceId).toBe(
      "default"
    )
    expect((await exportWorkspace()).document.boards[0].cards).toEqual(
      before.document.boards[0].cards
    )
  })
  it("restores validated preferences only with a complete workspace replacement", async () => {
    setPreferences({ language: "en", density: "compact", animations: false })
    const copy = await readBackup(await createBackup())
    setPreferences({ language: "ru", density: "normal", animations: true })
    await applyImport(copy, "replace", await previewImport(copy))
    expect(preferencesSnapshot()).toMatchObject({
      language: "en",
      density: "compact",
      animations: false,
    })
    setPreferences({ language: "ru", density: "normal", animations: true })
  })
  it("moves and archives projects without touching cards or attachments, then restores all organization", async () => {
    const before = await exportWorkspace(),
      boardId = before.document.boards[0].dashboard.id
    const workspaceId = await createWorkspace("CHOPIK"),
      projectId = await createProject("Видео", workspaceId)
    await moveBoardGroup(boardId, workspaceId, projectId)
    await changeProject(projectId, { archived: true })
    const saved = await exportWorkspace(),
      copy = await readBackup(await createBackup())
    expect(saved.document.organization?.workspaces).toContainEqual({
      id: workspaceId,
      title: "CHOPIK",
    })
    expect(saved.document.workspace?.sidebar?.items).toContainEqual(
      expect.objectContaining({
        id: projectId,
        workspaceId,
        archived: true,
        boardIds: [boardId],
      })
    )
    expect(saved.document.boards[0].cards).toEqual(
      before.document.boards[0].cards
    )
    expect(saved.document.boards[0].columns).toEqual(
      before.document.boards[0].columns
    )
    expect(copy.document).toMatchObject(
      JSON.parse(
        JSON.stringify({
          organization: saved.document.organization,
          workspace: saved.document.workspace,
          boards: saved.document.boards,
        })
      )
    )
    await moveBoardGroup(boardId, "default")
    await applyImport(copy, "replace", await previewImport(copy))
    expect((await readOrganization()).sidebar.workspaces).toEqual(
      saved.document.organization?.workspaces
    )
    expect((await exportWorkspace()).document.boards).toEqual(
      saved.document.boards
    )
  })
  it("imports a single board with its workspace metadata and keeps existing names", async () => {
    const space = await createWorkspace("Рабочее пространство"),
      boardId = (await exportWorkspace()).document.boards[0].dashboard.id
    await moveBoardGroup(boardId, space)
    const payload = await exportWorkspace(boardId)
    const board = payload.document.boards[0]
    board.dashboard.id = "imported-board"
    board.columns.forEach((col) => {
      const old = col.id
      col.id = `import-${old}`
      col.dashboardId = board.dashboard.id
      board.cards
        .filter((c) => c.columnId === old)
        .forEach((c) => {
          c.id = `import-${c.id}`
          c.columnId = col.id
        })
    })
    payload.document.organization!.workspaces.find(
      (w) => w.id === space
    )!.title = "Не перезаписывать имя"
    await applyImport(payload, "add", await previewImport(payload))
    expect(
      (await readOrganization()).sidebar.workspaces?.find((w) => w.id === space)
        ?.title
    ).toBe("Рабочее пространство")
    expect(
      (await webDb.get<{ workspaceId: string }>("dashboards", "imported-board"))
        ?.workspaceId
    ).toBe(space)
  })
  it("refuses a missing destination without any partial organization writes", async () => {
    const before = await readOrganization(),
      boardId = before.dashboards[0].id
    expect(() => placeBoardInGroup(before, boardId, "missing")).toThrow()
    await expect(
      moveBoardGroup(boardId, "default", "missing-folder")
    ).rejects.toThrow()
    expect(await readOrganization()).toEqual(before)
  })
  it("serializes simultaneous title/body/progress/attachment edits without lost fields", async () => {
    const card = (await exportWorkspace()).document.boards[0].cards[0]
    await Promise.all([
      updateCard(card.id, { title: "Одновременно" }),
      updateCard(card.id, { body: "- [x] Текст" }),
      updateCard(card.id, { progress: 0 }),
      updateCard(card.id, { tags: ["важно"] }),
    ])
    expect(await webDb.get("cards", card.id)).toMatchObject({
      title: "Одновременно",
      body: "- [x] Текст",
      progress: 0,
      tags: ["важно"],
    })
  })
  it("accepts legacy JSON v1/v2 and exports current schema v5", async () => {
    const payload = await exportWorkspace()
    expect(payload.document.schemaVersion).toBe(5)
    payload.document.schemaVersion = 1
    expect(
      (await decodeImport(encodeJson(payload.document))).document.boards
    ).toEqual(payload.document.boards)
    payload.document.schemaVersion = 2
    expect(
      (await decodeImport(encodeJson(payload.document))).document.boards
    ).toEqual(payload.document.boards)
  })
  it("rejects an otherwise valid document with an unknown schema version", async () => {
    const payload = await exportWorkspace()
    expect(() =>
      validateDocument({ ...payload.document, schemaVersion: 987 })
    ).toThrow()
  })
  it("preserves section order and progress modes through JSON and backup", async () => {
    const payload = await exportWorkspace(),
      board = payload.document.boards[0]
    await ensureLayout(board.dashboard.id, "free")
    await changeLayout(board.dashboard.id, (l) => ({
      ...l,
      sections: {
        ...l.sections,
        [board.columns[0].id]: {
          ...l.sections[board.columns[0].id],
          position: "a9",
          progressMode: "position",
          collapsed: true,
        },
      },
    }))
    const result = await exportWorkspace(),
      restored = await readBackup(await createBackup())
    expect(restored.document.boards).toEqual(result.document.boards)
    expect(
      restored.document.boards[0].dashboard.layout?.sections[
        board.columns[0].id
      ]
    ).toMatchObject({
      position: "a9",
      progressMode: "position",
      collapsed: true,
    })
  })
  it("roundtrips free/matrix, progress, Markdown and attachments through backup and restore", async () => {
    const original = await exportWorkspace(),
      board = original.document.boards[0],
      card = board.cards[0]
    const stored = await new LocalFiles().put(card.id, {
      name: "Сценарий.txt",
      mime: "text/plain",
      bytes: new Blob(["Файл ё"]),
    })
    await webDb.set("cards", card.id, {
      ...card,
      body: "# Проект\n- [x] готово\n- [ ] монтаж",
      progress: 0,
      attachments: [{ ...stored, id: "asset", name: "Сценарий.txt" }],
    })
    await updateDashboard(board.dashboard.id, (b) => ({ ...b, progress: 65 }))
    await ensureLayout(board.dashboard.id, "free")
    await changeLayout(board.dashboard.id, (l) => ({
      ...l,
      sections: {
        ...l.sections,
        [board.columns[0].id]: {
          ...l.sections[board.columns[0].id],
          laneId: l.lanes[1].id,
          collapsed: true,
        },
      },
    }))
    const free = await exportWorkspace()
    await ensureLayout(board.dashboard.id, "matrix")
    await ensureLayout(board.dashboard.id, "free")
    const after = await exportWorkspace()
    expect(after.document.boards).toEqual(
      free.document.boards.map((b) => ({
        ...b,
        dashboard: {
          ...b.dashboard,
          updatedAt: after.document.boards[0].dashboard.updatedAt,
        },
      }))
    )
    const backup = await createBackup(),
      payload = await readBackup(backup)
    await applyImport(payload, "replace", await previewImport(payload))
    expect((await exportWorkspace()).document.boards).toEqual(
      after.document.boards
    )
    expect(await [...payload.files.values()][0].text()).toBe("Файл ё")
    expect(
      (await exportWorkspace()).document.boards[0].dashboard.progress
    ).toBe(65)
  })
  it("refuses a layout migration if the safety copy cannot be written", async () => {
    const before = await exportWorkspace()
    const spy = vi
      .spyOn(webDb, "run")
      .mockRejectedValueOnce(new Error("Disk full"))
    await expect(
      ensureLayout(before.document.boards[0].dashboard.id, "matrix")
    ).rejects.toThrow()
    spy.mockRestore()
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
  })
  it("rejects invalid axis references without modifying data", async () => {
    const payload = await exportWorkspace(),
      board = payload.document.boards[0]
    board.dashboard.layout = initialLayout(board.columns, "matrix")
    board.cards[0].stageId = "missing-stage"
    expect(() => validateDocument(payload.document)).toThrow(/этап/)
    expect(
      (await exportWorkspace()).document.boards[0].cards[0].stageId
    ).toBeUndefined()
  })
  it("roundtrips Cyrillic, Markdown checklists, tags, priorities, ordering and future extensions", async () => {
    const payload = await exportWorkspace()
    payload.document.boards[0].cards[0].body =
      "# Кириллица ё\n- [x] готово\n- [ ] ещё\n**важно** <>&"
    payload.document.boards[0].cards[0].priority = "high"
    payload.document.boards[0].cards[0].tags = ["проект"]
    payload.document.boards[0].extensions = { futureLayout: { progress: null } }
    const restored = await decodeImport(await encodeArchive(payload))
    expect(restored.document).toEqual(payload.document)
    const plain = await decodeImport(strToU8(JSON.stringify(payload.document)))
    expect(plain.document).toEqual(payload.document)
  })
  it("roundtrips attachment bytes and refuses incomplete JSON", async () => {
    const storage = new LocalFiles()
    const stored = await storage.put("bordena-card-0", {
      name: "файл.txt",
      mime: "text/plain",
      bytes: new Blob(["Вложение"]),
    })
    const card = await webDb.get<{ attachments: object[] }>(
      "cards",
      "bordena-card-0"
    )
    await webDb.set("cards", "bordena-card-0", {
      ...card,
      attachments: [{ ...stored, id: "file-1", name: "файл.txt" }],
    })
    const payload = await exportWorkspace()
    expect(payload.files.size).toBe(1)
    const restored = await decodeImport(await encodeArchive(payload))
    expect(await [...restored.files.values()][0].text()).toBe("Вложение")
    await expect(
      decodeImport(strToU8(JSON.stringify(payload.document)))
    ).rejects.toThrow(/Вложение/)
    const p = payload.document.attachmentsManifest[0].path
    payload.files.set(p, new Blob(["испорчено"]))
    await expect(encodeArchive(payload)).rejects.toThrow()
  })
  it.each([
    "{broken",
    '{"format":"kanri","schemaVersion":1}',
    '{"format":"bordena","schemaVersion":2}',
  ])("rejects invalid JSON/version %s", async (input) => {
    await expect(decodeImport(strToU8(input))).rejects.toThrow()
  })
  it("rejects unsafe archive paths and corrupt checksums", async () => {
    const badPath = zipSync({ "../outside.txt": strToU8("bad") })
    await expect(decodeImport(badPath)).rejects.toThrow()
    const badHash = zipSync({
      "bordena.json": strToU8("{}"),
      "bordena.sha256": strToU8("0".repeat(64)),
    })
    await expect(decodeImport(badHash)).rejects.toThrow(/целостность/)
  })
  it("never exports standalone JSON that its importer would reject for total size", async () => {
    const payload = await exportWorkspace()
    const template = payload.document.boards[0].cards[0]
    payload.document.boards[0].cards = Array.from(
      { length: 9 },
      (_, index) => ({
        ...template,
        id: `large-${index}`,
        body: "я".repeat(1024 * 1024),
      })
    )
    expect(() => encodeJson(payload.document)).toThrow(/16 МиБ/)
  })
  it("rejects duplicate IDs, broken references and oversized files", async () => {
    const { document } = await exportWorkspace()
    document.boards[0].cards[0].id = document.boards[0].dashboard.id
    expect(() => validateDocument(document)).toThrow(/идентификатор/)
    document.boards[0].cards[0].id = "ok"
    document.boards[0].cards[0].columnId = "missing"
    expect(() => validateDocument(document)).toThrow(/связь/)
    await expect(
      decodeImport(new Uint8Array(MAX_ARCHIVE_BYTES + 1))
    ).rejects.toThrow(/128/)
  })
})

describe("transactional backup and restore", () => {
  it("cancels a repeated import without changing existing data", async () => {
    const payload = await exportWorkspace(),
      preview = await previewImport(payload)
    expect(preview.conflicts).toBeGreaterThan(0)
    await expect(applyImport(payload, "add", preview)).rejects.toThrow(
      /Конфликт ID/
    )
    expect((await exportWorkspace()).document.boards).toEqual(
      payload.document.boards
    )
  })
  it("restores the workspace and creates a verified pre-replace backup", async () => {
    const before = await exportWorkspace()
    const payload = await decodeImport(await encodeArchive(before))
    payload.document.boards[0].dashboard.title = "Восстановлено"
    const preview = await previewImport(payload)
    await applyImport(payload, "replace", preview)
    expect((await exportWorkspace()).document.boards[0].dashboard.title).toBe(
      "Восстановлено"
    )
    const backups = await listBackups()
    expect(backups).toHaveLength(1)
    expect((await readBackup(backups[0])).document.boards).toEqual(
      before.document.boards
    )
  })
  it("refuses restore after edits made since preview", async () => {
    const payload = await exportWorkspace(),
      preview = await previewImport(payload)
    const card = payload.document.boards[0].cards[0]
    await webDb.set("cards", card.id, { ...card, title: "Другая запись" })
    const backupCount = (await listBackups()).length
    await expect(applyImport(payload, "replace", preview)).rejects.toThrow(
      /изменились/
    )
    expect(await listBackups()).toHaveLength(backupCount)
  })
  it("refuses replacement when backup persistence fails and keeps every board", async () => {
    const payload = await exportWorkspace(),
      preview = await previewImport(payload)
    const spy = vi
      .spyOn(webDb, "run")
      .mockImplementationOnce(() =>
        Promise.reject(new DOMException("Quota", "QuotaExceededError"))
      )
    await expect(applyImport(payload, "replace", preview)).rejects.toThrow()
    spy.mockRestore()
    expect((await exportWorkspace()).document.boards).toEqual(
      payload.document.boards
    )
  })
  it("verifies manual backups and rejects corruption", async () => {
    const record = await createBackup()
    expect(record.sha256).toBe(await sha256(record.bytes))
    expect((await readBackup(record)).document.boards).toHaveLength(1)
    record.bytes[10] ^= 1
    await expect(readBackup(record)).rejects.toThrow(/повреждена/)
  })
  it("exports a single board and disallows full replacement from it", async () => {
    const payload = await exportWorkspace("bordena-welcome")
    expect(payload.document.scope).toBe("board")
    expect(payload.document.workspace).toBeUndefined()
    await expect(
      applyImport(payload, "replace", await previewImport(payload))
    ).rejects.toThrow(/всего пространства/)
  })
  it("rejects writes from a window opened before a replacement", async () => {
    const staleWindow = new BordenaDB("bordena", 15)
    await staleWindow.bindEpoch()
    const payload = await exportWorkspace()
    await applyImport(payload, "replace", await previewImport(payload))
    await expect(
      staleWindow.set("cards", "late-write", { title: "stale" })
    ).rejects.toThrow(/другом окне/)
    expect(await webDb.get("cards", "late-write")).toBeUndefined()
  })
  it("does not repopulate an intentionally empty restored workspace", async () => {
    const payload: ImportPayload = {
      document: {
        format: "bordena",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        scope: "workspace",
        boards: [],
        attachmentsManifest: [],
      },
      files: new Map(),
    }
    await applyImport(payload, "replace", await previewImport(payload))
    await initializeWorkspace()
    expect(await webDb.count("dashboards")).toBe(0)
    expect(await webDb.count(BACKUPS)).toBe(1)
  })
  it("keeps Doska IDB separate even in the same temporary origin", async () => {
    const doska = new BordenaDB("deck", 15)
    await doska.set("cards", "sentinel", {
      id: "sentinel",
      body: "Original data",
    })
    await webDb.set("cards", "sentinel", { id: "sentinel", body: "Bordena" })
    await webDb.delete("cards", "sentinel")
    expect(await doska.get("cards", "sentinel")).toEqual({
      id: "sentinel",
      body: "Original data",
    })
    expect(await webDb.count(BLOBS)).toBe(0)
  })
})

describe("0.5 Goal Path and durable rules", () => {
  const rule = (patch: Partial<AutomationRule> = {}): AutomationRule => ({
    id: "test-rule",
    title: "Own rule",
    revision: 1,
    enabled: true,
    paused: false,
    condition: { type: "deadline" },
    action: { type: "history", message: "Expired" },
    ...patch,
  })
  const setupGoal = async () => {
    const b = (await exportWorkspace()).document.boards[0]
    await applyOperations([
      {
        op: "configure-goal-path",
        id: b.dashboard.id,
        expectedUpdatedAt: b.dashboard.updatedAt,
        stages: [
          { id: "goal-start", title: "Старт" },
          { id: "goal-finish", title: "Результат" },
        ],
        goalPath: {
          schemaVersion: 1,
          progressMode: "metric",
          manualProgress: 37,
          steps: [
            { id: "goal-start", required: true, status: "not-started" },
            { id: "goal-finish", required: false, status: "not-started" },
          ],
          metrics: [
            {
              id: "own-metric",
              title: "Моя метрика",
              start: 0,
              target: 10,
              current: 5,
              unit: "шагов",
              direction: "increase",
            },
          ],
          metricId: "own-metric",
        },
      },
    ])
    return (await exportWorkspace()).document.boards[0]
  }
  it("protects the first v4 edit with a verified v4 checkpoint, exactly once", async () => {
    await webDb.set("meta", "bordena:model-revision", 4)
    const old = (await exportWorkspace()).document.boards
    await setupGoal()
    const copies = await listBackups()
    expect(copies).toHaveLength(1)
    const backup = await readBackup(copies[0])
    expect(backup.document.schemaVersion).toBe(4)
    expect(backup.document.boards).toEqual(old)
    await updateCard(old[0].cards[0].id, { priority: "high" })
    expect(await listBackups()).toHaveLength(1)
    expect(await webDb.get("meta", "bordena:model-revision")).toBe(6)
  })
  it("roundtrips steps, measurements, rules, execution state, Markdown and media through verified backup", async () => {
    const b = await setupGoal()
    const c = b.cards[0]
    await applyOperations([
      {
        op: "record-measurement",
        id: b.dashboard.id,
        expectedUpdatedAt: b.dashboard.updatedAt,
        metricId: "own-metric",
        measurement: {
          id: "measurement",
          date: "2026-10-18T12:00:00+03:00",
          value: 8,
        },
        makeCurrent: true,
      },
      {
        op: "update-card",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        patch: { deadline: "2000-01-01" },
      },
      {
        op: "upsert-rule",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        rule: rule(),
      },
    ])
    const before = await exportWorkspace(),
      copy = await createBackup(),
      decoded = await readBackup(copy)
    expect(decoded.document.schemaVersion).toBe(5)
    expect(decoded.document.boards).toEqual(before.document.boards)
    await applyImport(decoded, "replace", await previewImport(decoded))
    await webDb.bindEpoch()
    expect((await exportWorkspace()).document.boards).toEqual(
      before.document.boards
    )
    requestLinkedSync()
    await flushLinkedSync()
    expect(
      (await webDb.get<Card>("cards", c.id))?.automationState?.[0].result
    ).toBe("applied")
    expect(
      (await webDb.getAll<{ data: { reason?: string } }>("history")).filter(
        (h) => h.data.reason === "automation"
      )
    ).toHaveLength(1)
  })
  it("runs saved deadlines through the existing coordinator once, keeps later text, and undoes safely", async () => {
    const b = await setupGoal(),
      c = b.cards[0],
      target = b.columns[1]
    await applyOperations([
      {
        op: "upsert-rule",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        rule: rule({ action: { type: "move-section", columnId: target.id } }),
      },
    ])
    resetStructuralHistory()
    await updateCard(c.id, { deadline: "2000-01-01" })
    requestLinkedSync(c.id)
    await flushLinkedSync()
    expect((await webDb.get<Card>("cards", c.id))?.columnId).toBe(target.id)
    await updateCard(c.id, { body: "Новейший текст" })
    expect(await historyAction("undo")).toBe(true)
    expect((await webDb.get<Card>("cards", c.id))?.columnId).toBe(c.columnId)
    expect((await webDb.get<Card>("cards", c.id))?.body).toBe("Новейший текст")
    requestLinkedSync()
    await flushLinkedSync()
    expect((await webDb.get<Card>("cards", c.id))?.columnId).toBe(c.columnId)
  })
  it("refuses structural Undo after a conflicting manual move", async () => {
    const b = await setupGoal(),
      c = b.cards[0]
    await applyOperations([
      {
        op: "upsert-rule",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        rule: rule({ action: { type: "set-progress", value: 85 } }),
      },
    ])
    resetStructuralHistory()
    await updateCard(c.id, { deadline: "2000-01-01" })
    requestLinkedSync(c.id)
    await flushLinkedSync()
    await updateCard(c.id, { progress: 42 })
    await expect(historyAction("undo")).rejects.toThrow(/History conflict/)
    expect((await webDb.get<Card>("cards", c.id))?.progress).toBe(42)
  })
  it("aborts effects, execution consumption and history together after an injected storage failure", async () => {
    const b = await setupGoal(),
      c = b.cards[0]
    await applyOperations([
      {
        op: "upsert-rule",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        rule: rule({ action: { type: "set-progress", value: 85 } }),
      },
    ])
    await updateCard(c.id, { deadline: "2000-01-01" })
    const before = (await exportWorkspace()).document
    const proto = Object.getPrototypeOf(
        (await webDb.open()).transaction("history").objectStore("history")
      ) as IDBObjectStore,
      put = proto.put
    const fail = vi.spyOn(proto, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey
    ) {
      if (this.name === "history")
        throw new DOMException(
          "Injected automation failure",
          "QuotaExceededError"
        )
      return put.call(this, value, key)
    })
    try {
      requestLinkedSync(c.id)
      await expect(flushLinkedSync()).rejects.toThrow(/Injected automation/)
    } finally {
      fail.mockRestore()
    }
    expect((await exportWorkspace()).document.boards).toEqual(before.boards)
    expect((await exportWorkspace()).document.workspace?.history).toEqual(
      before.workspace?.history
    )
    requestLinkedSync(c.id)
    await flushLinkedSync()
    expect((await webDb.get<Card>("cards", c.id))?.progress).toBe(85)
  })
  it("retains event consumption when undoing a complete external Changeset", async () => {
    const b = await setupGoal(),
      c = b.cards[0]
    await applyOperations([
      {
        op: "upsert-rule",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        rule: rule({ action: { type: "set-progress", value: 85 } }),
      },
    ])
    await updateCard(c.id, { deadline: "2000-01-01" })
    const latest = (await webDb.get<Card>("cards", c.id))!
    await applyChangeset({
      format: "bordena-changeset",
      schemaVersion: 1,
      id: "aw005-whole-undo",
      operations: [
        {
          op: "update-card",
          id: c.id,
          expectedUpdatedAt: latest.updatedAt,
          patch: { title: "Batch title" },
        },
      ],
    })
    expect((await webDb.get<Card>("cards", c.id))?.progress).toBe(85)
    await undoChangeset()
    requestLinkedSync()
    await flushLinkedSync()
    expect((await webDb.get<Card>("cards", c.id))?.progress).toBe(
      latest.progress
    )
    expect((await webDb.get<Card>("cards", c.id))?.title).toBe(latest.title)
  })
  it("pauses, disables, re-enables and removes a saved rule through the existing command service", async () => {
    const b = await setupGoal(),
      c = b.cards[0]
    await applyOperations([
      {
        op: "upsert-rule",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        rule: rule({ action: { type: "set-progress", value: 85 } }),
      },
    ])
    const paused = (await webDb.get<Card>("cards", c.id))!
    await applyOperations([
      {
        op: "set-rule-enabled",
        id: c.id,
        expectedUpdatedAt: paused.updatedAt,
        ruleId: "test-rule",
        enabled: true,
        paused: true,
      },
    ])
    await updateCard(c.id, { deadline: "2000-01-01" })
    requestLinkedSync()
    await flushLinkedSync()
    expect((await webDb.get<Card>("cards", c.id))?.progress).not.toBe(85)
    const resume = (await webDb.get<Card>("cards", c.id))!
    await applyOperations([
      {
        op: "set-rule-enabled",
        id: c.id,
        expectedUpdatedAt: resume.updatedAt,
        ruleId: "test-rule",
        enabled: true,
        paused: false,
      },
    ])
    expect((await webDb.get<Card>("cards", c.id))?.progress).toBe(85)
    const remove = (await webDb.get<Card>("cards", c.id))!
    await applyOperations([
      {
        op: "remove-rule",
        id: c.id,
        expectedUpdatedAt: remove.updatedAt,
        ruleId: "test-rule",
      },
    ])
    await updateCard(c.id, { progress: 7, deadline: "2000-01-02" })
    requestLinkedSync()
    await flushLinkedSync()
    expect((await webDb.get<Card>("cards", c.id))?.progress).toBe(7)
  })
  it("invalidates a cached snapshot after another locked writer even before broadcast delivery", async () => {
    const b = await setupGoal(),
      c = b.cards[0]
    await applyOperations([
      {
        op: "upsert-rule",
        id: c.id,
        expectedUpdatedAt: c.updatedAt,
        rule: rule({ action: { type: "set-progress", value: 85 } }),
      },
    ])
    requestLinkedSync()
    await flushLinkedSync()
    const other = new BordenaDB("bordena", 15)
    await other.bindEpoch()
    await other.writeLocked(async () => {
      const latest = (await other.get<Card>("cards", c.id))!
      await other.run("cards", "readwrite", (store) =>
        store.put(
          { ...latest, body: "Запись из другого окна", deadline: "2000-01-01" },
          c.id
        )
      )
    })
    ;(await other.open()).close()
    requestLinkedSync(c.id)
    await flushLinkedSync()
    const after = await webDb.get<Card>("cards", c.id)
    expect(after?.progress).toBe(85)
    expect(after?.body).toBe("Запись из другого окна")
  })
  it("removes route steps without deleting their axes, sections or cards", async () => {
    const b = await setupGoal(),
      g = b.dashboard.goalPath!
    await applyOperations([
      {
        op: "configure-goal-path",
        id: b.dashboard.id,
        expectedUpdatedAt: b.dashboard.updatedAt,
        goalPath: { ...g, steps: [] },
      },
    ])
    const after = (await exportWorkspace()).document.boards[0]
    expect(after.cards).toEqual(b.cards)
    expect(after.columns).toEqual(b.columns)
    expect(
      after.dashboard.layout?.stages.some((s) => s.id === "goal-start")
    ).toBe(true)
  })
  it("applies all nineteen Goal templates with new IDs and no actual measurements or automatic opt-in", async () => {
    const templates = builtinTemplates.filter((t) => t.goalPath)
    expect(templates).toHaveLength(19)
    for (const [i, template] of templates.entries()) {
      await applyOperations([
        {
          op: "create-board",
          id: `goal-template-${i}`,
          title: template.title,
          mode: "free",
        },
        {
          op: "apply-template",
          boardId: `goal-template-${i}`,
          templateId: template.id,
          includeExamples: true,
          includeAutomation: false,
        },
      ])
      const b = (await exportWorkspace()).document.boards.find(
        (b) => b.dashboard.id === `goal-template-${i}`
      )!
      expect(b.dashboard.goalPath?.steps.length).toBeGreaterThan(1)
      expect(
        b.dashboard.goalPath?.steps.every(
          (s) => !template.goalPath!.steps.some((x) => x.id === s.id)
        )
      ).toBe(true)
      expect(b.cards[0].automationRules).toBeUndefined()
    }
  })
  it("remaps a saved Goal template and strips current values and real measurement history", async () => {
    const b = await setupGoal(),
      template = {
        id: "own-goal",
        title: "Own",
        category: "Personal",
        mode: "free" as const,
        sections: b.columns.map((c) => ({
          sourceId: c.id,
          title: c.title,
          color: c.color,
          done: c.done,
          progressMode: "manual" as const,
        })),
        layout: b.dashboard.layout,
        goalPath: {
          ...b.dashboard.goalPath!,
          metrics: b.dashboard.goalPath!.metrics.map((m) => ({
            ...m,
            history: [{ id: "old", date: "2026-01-01", value: 5 }],
          })),
        },
        fields: [],
        examples: [],
      }
    await applyOperations([
      { op: "save-template", template },
      { op: "create-board", id: "goal-copy", title: "Copy", mode: "free" },
      {
        op: "apply-template",
        boardId: "goal-copy",
        templateId: template.id,
        includeExamples: false,
        includeAutomation: false,
      },
    ])
    const copy = (await exportWorkspace()).document.boards.find(
      (b) => b.dashboard.id === "goal-copy"
    )!.dashboard.goalPath!
    expect(copy.manualProgress).toBeNull()
    expect(copy.metrics[0].current).toBeNull()
    expect(copy.metrics[0].history).toEqual([])
    expect(copy.metrics[0].id).not.toBe("own-metric")
  })
  it("rejects malformed Goal references and rule targets without any partial write", async () => {
    const b = await setupGoal(),
      c = b.cards[0],
      before = (await exportWorkspace()).document.boards
    await expect(
      applyOperations([
        {
          op: "update-card",
          id: c.id,
          expectedUpdatedAt: c.updatedAt,
          patch: { title: "Temporary" },
        },
        {
          op: "upsert-rule",
          id: c.id,
          expectedUpdatedAt: c.updatedAt,
          rule: rule({
            action: { type: "move-section", columnId: "not-here" },
          }),
        },
      ])
    ).rejects.toThrow()
    expect((await exportWorkspace()).document.boards).toEqual(before)
    await expect(
      applyOperations([
        {
          op: "configure-goal-path",
          id: b.dashboard.id,
          expectedUpdatedAt: b.dashboard.updatedAt,
          goalPath: {
            ...b.dashboard.goalPath!,
            steps: [{ id: "absent", required: true, status: "not-started" }],
          },
        },
      ])
    ).rejects.toThrow()
  })
  it("rejects a stale metric update, reordered-ID mismatch and duplicate measurements atomically", async () => {
    const b = await setupGoal()
    await expect(
      applyOperations([
        {
          op: "set-goal-metric",
          id: b.dashboard.id,
          expectedUpdatedAt: 0,
          metric: b.dashboard.goalPath!.metrics[0],
        },
      ])
    ).rejects.toThrow(/Stale/)
    await expect(
      applyOperations([
        {
          op: "reorder-goal-steps",
          id: b.dashboard.id,
          expectedUpdatedAt: b.dashboard.updatedAt,
          stepIds: ["goal-start", "goal-start"],
        },
      ])
    ).rejects.toThrow()
    await expect(
      applyOperations(
        [1, 2].map(() => ({
          op: "record-measurement" as const,
          id: b.dashboard.id,
          expectedUpdatedAt: b.dashboard.updatedAt,
          metricId: "own-metric",
          measurement: { id: "same", date: "2026-01-01", value: 1 },
          makeCurrent: false,
        }))
      )
    ).rejects.toThrow(/ID already/)
    expect(
      (await webDb.get<Dashboard>("dashboards", b.dashboard.id))?.goalPath
        ?.metrics[0].history
    ).toBeUndefined()
  })
})
