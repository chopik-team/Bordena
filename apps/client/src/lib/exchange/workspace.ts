import { t } from "@bordena/i18n"
import { flushCardEdits } from "@bordena/core"
import {
  CardSchema,
  CalendarStateSchema,
  emptyCalendarState,
  type CalendarState,
} from "@bordena/contract"
import type {
  Card,
  Column,
  Dashboard,
  HistoryEntry,
  SidebarLayout,
} from "@bordena/contract"
import { generateKeyBetween } from "fractional-indexing"
import {
  webDb,
  BLOBS,
  BACKUPS,
  withDataLock,
  notifyDataWrite,
  type DataWrite,
} from "../adapters/web-db"
import { blobKey } from "../adapters/local-files"
import { preferencesSnapshot, setPreferences } from "../preferences"
import {
  type BordenaDocument,
  type ImportPayload,
  validateDocument,
  sha256,
  encodeArchive,
  decodeImport,
} from "./format"
const STORES = [
  "dashboards",
  "columns",
  "cards",
  "sidebar",
  "history",
  BLOBS,
  "meta",
]
type Rows = Record<
  string,
  {
    key: string
    value: unknown
  }[]
>
/** One native readonly transaction produces a coherent workspace snapshot. */
async function snapshot(): Promise<Rows> {
  const db = await webDb.open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, "readonly")
    const rows: Rows = {}
    for (const store of STORES) {
      const objectStore = tx.objectStore(store)
      const keys = objectStore.getAllKeys()
      const values = objectStore.getAll()
      values.onsuccess = () => {
        rows[store] = values.result.map((value, i) => ({
          key: String(keys.result[i]),
          value,
        }))
      }
    }
    tx.oncomplete = () => resolve(rows)
    tx.onerror = tx.onabort = () =>
      reject(new Error(t("Не удалось прочитать локальные данные")))
  })
}
async function stateToken(rows: Rows): Promise<string> {
  // Ignore bookkeeping: the HLC may advance without a change in user content.
  const content = Object.fromEntries(
    Object.entries(rows).filter(([key]) => key !== "meta")
  )
  content.meta = rows.meta.filter((x) =>
    [
      "bordena:epoch",
      "bordena:exchange",
      "bordena:model-revision",
      "bordena:calendar",
    ].includes(x.key)
  )
  return sha256(
    new TextEncoder().encode(
      JSON.stringify(content, (_key, value) =>
        value instanceof Blob ? { size: value.size, type: value.type } : value
      )
    )
  )
}
async function fromSnapshot(
  rows: Rows,
  boardId?: string
): Promise<ImportPayload> {
  const dashboards = rows.dashboards
    .map((x) => x.value as Dashboard)
    .filter((d) => !boardId || d.id === boardId)
  if (boardId && !dashboards.length) throw new Error(t("Доска не найдена"))
  const columns = rows.columns.map((x) => x.value as Column)
  const cards = rows.cards.map((x) => x.value as Card)
  const sidebar = rows.sidebar.find((x) => x.key === "layout")?.value as
    SidebarLayout | undefined
  const workspaces = sidebar?.workspaces?.length
    ? sidebar.workspaces
    : [{ id: "default", title: t("Личное пространство") }]
  const stored = rows.meta.find((x) => x.key === "bordena:exchange")?.value as
    | {
        boards?: Record<string, BordenaDocument["extensions"]>
        extensions?: BordenaDocument["extensions"]
      }
    | undefined
  const document: BordenaDocument = {
    format: "bordena",
    schemaVersion: 5,
    exportedAt: new Date().toISOString(),
    scope: boardId ? "board" : "workspace",
    boards: dashboards.map((dashboard) => {
      const cols = columns.filter((c) => c.dashboardId === dashboard.id)
      const ids = new Set(cols.map((c) => c.id))
      return {
        dashboard,
        columns: cols,
        cards: cards.filter((c) => ids.has(c.columnId)),
        extensions: stored?.boards?.[dashboard.id],
      }
    }),
    attachmentsManifest: [],
    organization: { workspaces },
    preferences: boardId ? undefined : { ...preferencesSnapshot() },
    extensions: stored?.extensions,
  }
  const calendar = rows.meta.find((row) => row.key === "bordena:calendar")
    ?.value as CalendarState | undefined
  if (!boardId && calendar) {
    document.calendar = CalendarStateSchema.parse(calendar)
    document.schemaVersion = 6
  }
  if (!boardId) {
    const boardIds = new Set(dashboards.map((d) => d.id))
    document.workspace = {
      sidebar: rows.sidebar.find((x) => x.key === "layout")?.value as
        SidebarLayout | undefined,
      history: rows.history
        .map((x) => x.value as HistoryEntry)
        .filter((h) => boardIds.has(h.boardId) || h.boardId === "calendar"),
    }
    // Removed boards can leave stale navigation entries; only export existing IDs.
    if (document.workspace.sidebar)
      document.workspace.sidebar = {
        ...document.workspace.sidebar,
        // Workspace definitions have one canonical location, also in single-board exports.
        workspaces: undefined,
        items: document.workspace.sidebar.items.flatMap<
          SidebarLayout["items"][number]
        >((item) =>
          item.type === "board"
            ? boardIds.has(item.id)
              ? [item]
              : []
            : [
                {
                  ...item,
                  boardIds: item.boardIds.filter((id) => boardIds.has(id)),
                },
              ]
        ),
      }
    if (document.workspace.sidebar) delete document.workspace.sidebar.workspaces
  }
  const blobs = new Map(rows[BLOBS].map((x) => [x.key, x.value as Blob]))
  const files = new Map<string, Blob>()
  for (const board of document.boards)
    for (const card of board.cards)
      for (const att of card.attachments) {
        const blob = blobs.get(blobKey(card.id, att.key))
        if (!blob || blob.size !== att.size)
          throw new Error(
            t("Экспорт остановлен: локальное вложение отсутствует")
          )
        const path = `attachments/${card.id}/${att.key.slice(4)}`
        document.attachmentsManifest.push({
          cardId: card.id,
          key: att.key,
          path,
          size: blob.size,
          sha256: await sha256(new Uint8Array(await blob.arrayBuffer())),
        })
        files.set(path, blob)
      }
  return { document: validateDocument(document), files }
}
export async function exportWorkspace(
  boardId?: string
): Promise<ImportPayload> {
  // Flush before acquiring the data lock: editor writes acquire the same lock.
  await flushCardEdits()
  return withDataLock(async () => fromSnapshot(await snapshot(), boardId))
}
/** Captures data and its optimistic concurrency token under the same lock. */
export function exportWorkspaceWithPreview(): Promise<{
  payload: ImportPayload
  preview: ImportPreview
}> {
  return withDataLock(async () => {
    const rows = await snapshot(),
      payload = await fromSnapshot(rows)
    return { payload, preview: await previewFor(payload, rows) }
  })
}
export interface ImportPreview {
  token: string
  boards: number
  columns: number
  cards: number
  attachments: number
  conflicts: number
  existingBoards: number
}
async function previewFor(
  payload: ImportPayload,
  rows: Rows
): Promise<ImportPreview> {
  const doc = validateDocument(payload.document)
  const ids = new Set(
    [...rows.dashboards, ...rows.columns, ...rows.cards, ...rows.history].map(
      (x) => x.key
    )
  )
  const incoming = doc.boards.flatMap((b) => [
    b.dashboard.id,
    ...b.columns.map((c) => c.id),
    ...b.cards.map((c) => c.id),
  ])
  const calendar = rows.meta.find((r) => r.key === "bordena:calendar")
    ?.value as CalendarState | undefined
  for (const e of [
    ...(calendar?.calendars ?? []),
    ...(calendar?.events ?? []),
    ...(calendar?.profiles ?? []),
  ])
    ids.add(e.id)
  incoming.push(
    ...[
      ...(doc.calendar?.calendars ?? []),
      ...(doc.calendar?.events ?? []),
      ...(doc.calendar?.profiles ?? []),
    ].map((e) => e.id)
  )
  incoming.push(...(doc.workspace?.history.map((h) => h.id) ?? []))
  return {
    token: await stateToken(rows),
    boards: doc.boards.length,
    columns: doc.boards.reduce((n, b) => n + b.columns.length, 0),
    cards: doc.boards.reduce((n, b) => n + b.cards.length, 0),
    attachments: doc.attachmentsManifest.length,
    conflicts: incoming.filter((id) => ids.has(id)).length,
    existingBoards: rows.dashboards.length,
  }
}
export function previewImport(payload: ImportPayload): Promise<ImportPreview> {
  return withDataLock(async () => previewFor(payload, await snapshot()))
}
export interface BackupRecord {
  id: string
  createdAt: string
  bytes: Uint8Array
  sha256: string
  kind?: "manual" | "automatic" | "changeset" | "checkpoint"
  reason?: string
}
async function backupSnapshot(
  rows: Rows,
  kind: BackupRecord["kind"] = "automatic",
  reason?: string
): Promise<BackupRecord> {
  const payload = await fromSnapshot(rows)
  const revision = rows.meta.find((row) => row.key === "bordena:model-revision")
    ?.value as number | undefined
  const hasNewModel =
    payload.document.boards.some(
      (board) =>
        [
          "color",
          "priority",
          "deadline",
          "fieldDefinitions",
          "mirrors",
          "tableFields",
          "defaultCalendarId",
        ].some(
          (key) =>
            (board.dashboard as unknown as Record<string, unknown>)[key] !==
            undefined
        ) ||
        board.cards.some(
          (card) =>
            [
              "boardLink",
              "linkedProgress",
              "fieldValues",
              "externalFiles",
            ].some(
              (key) =>
                (card as unknown as Record<string, unknown>)[key] !== undefined
            ) ||
            card.attachments.some(
              (attachment) =>
                attachment.pinned !== undefined ||
                attachment.group !== undefined
            )
        )
    ) ||
    payload.document.workspace?.sidebar?.templates !== undefined ||
    payload.document.workspace?.sidebar?.items.some(
      (item) =>
        item.type === "folder" &&
        (item.deadline !== undefined ||
          item.priority !== undefined ||
          item.color !== undefined)
    ) ||
    payload.document.extensions?.appliedChangesets !== undefined
  const hasPlanning =
    payload.document.boards.some(
      (b) =>
        b.dashboard.goalPath !== undefined ||
        b.cards.some(
          (c) =>
            c.automationRules !== undefined ||
            c.automationState !== undefined ||
            c.archived !== undefined
        )
    ) ||
    payload.document.workspace?.sidebar?.templates?.some(
      (t) => t.goalPath !== undefined
    )
  if ((revision ?? 0) < 5 && !hasPlanning) {
    payload.document.schemaVersion = 4
    for (const b of payload.document.boards)
      for (const c of b.cards) delete c.stamps.automation
  }
  // A pristine 0.3 checkpoint remains readable by the previous release.
  if ((revision ?? 0) < 4 && !hasNewModel) {
    payload.document.schemaVersion = 3
    if (payload.document.preferences) {
      delete payload.document.preferences.automaticBackups
      delete payload.document.preferences.windowsNotifications
    }
    for (const board of payload.document.boards)
      for (const card of board.cards) {
        delete card.stamps.links
        delete card.stamps.fields
      }
  }
  const bytes = await encodeArchive(payload)
  // Verify the exact archive before it can protect a destructive operation.
  await decodeImport(bytes)
  const record: BackupRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    bytes,
    sha256: await sha256(bytes),
    kind,
    reason,
  }
  await webDb.run(BACKUPS, "readwrite", (s) => s.put(record, record.id))
  const persisted = await webDb.get<BackupRecord>(BACKUPS, record.id)
  if (!persisted || (await sha256(persisted.bytes)) !== record.sha256)
    throw new Error(
      t("Резервная копия не прошла проверку записи; импорт отменён")
    )
  return record
}
export async function createBackup(
  kind: BackupRecord["kind"] = "manual",
  reason?: string
): Promise<BackupRecord> {
  await flushCardEdits()
  return withDataLock(async () =>
    backupSnapshot(await snapshot(), kind, reason)
  )
}
/** Internal: the caller already owns bordena-data-write. Never call public createBackup here. */
export async function ensureModelCheckpointLocked(): Promise<void> {
  if (((await webDb.get<number>("meta", "bordena:model-revision")) ?? 0) >= 6)
    return
  await backupSnapshot(await snapshot(), "checkpoint", "Модель 0.6")
  // The direct IDB helper avoids recursively acquiring the shared lock.
  await webDb.run("meta", "readwrite", (store) =>
    store.put(6, "bordena:model-revision")
  )
}
export async function listBackups(): Promise<BackupRecord[]> {
  return (await webDb.getAll<BackupRecord>(BACKUPS)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
}
export async function readBackup(record: BackupRecord): Promise<ImportPayload> {
  if ((await sha256(record.bytes)) !== record.sha256)
    throw new Error(t("Локальная резервная копия повреждена"))
  return decodeImport(record.bytes)
}
export async function pruneAutomaticBackups(): Promise<void> {
  await withDataLock(async () => {
    const keep = preferencesSnapshot().automaticBackups
    const records = (await listBackups()).filter(
      (record) => record.kind === "automatic" || record.kind === "changeset"
    )
    // Unknown legacy copies and explicitly manual/checkpoint copies are never removed.
    for (const record of records.slice(keep))
      await webDb.run(BACKUPS, "readwrite", (store) => store.delete(record.id))
  })
}
/** Metadata and managed bytes are removed together, after a verified safety copy. */
export async function deleteManagedAttachment(
  cardId: string,
  attachmentId: string
): Promise<void> {
  await webDb.writeLocked(async () => {
    await backupSnapshot(
      await snapshot(),
      "checkpoint",
      "Удаление управляемого вложения"
    )
    const database = await webDb.open()
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(["cards", BLOBS], "readwrite", {
          durability: "strict",
        }),
        cards = tx.objectStore("cards"),
        request = cards.get(cardId)
      let failure: unknown
      request.onsuccess = () => {
        try {
          const card = request.result as Card | undefined,
            attachment = card?.attachments.find((a) => a.id === attachmentId)
          if (!card || !attachment) throw new Error("Attachment is unavailable")
          const now = Math.max(Date.now(), card.updatedAt + 1)
          const next = CardSchema.parse({
            ...card,
            attachments: card.attachments.filter((a) => a.id !== attachmentId),
            updatedAt: now,
            stamps: { ...card.stamps, attachments: now },
          })
          cards.put(next, cardId)
          tx.objectStore(BLOBS).delete(blobKey(cardId, attachment.key))
        } catch (error) {
          failure = error
          tx.abort()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () =>
        reject(failure ?? tx.error ?? new Error("Attachment deletion failed"))
    })
  })
  await pruneAutomaticBackups()
}
/** A command writes only changed records. Managed blobs and the profile epoch stay intact. */
export async function applyPlannedDocument(
  document: BordenaDocument,
  expected: ImportPreview,
  options: { checkpoint: boolean; reason?: string }
): Promise<{ token: string; backup?: BackupRecord; writes: DataWrite[] }> {
  const result = await withDataLock(async () => {
    const next = validateDocument(document),
      rows = await snapshot()
    if (
      next.scope !== "workspace" ||
      expected.token !== (await stateToken(rows))
    )
      throw new Error(
        t("Данные изменились после просмотра. Выберите файл заново")
      )
    const original = await fromSnapshot(rows)
    if (
      JSON.stringify(original.document.attachmentsManifest) !==
      JSON.stringify(next.attachmentsManifest)
    )
      throw new Error("Commands cannot replace managed attachments")
    const backup = options.checkpoint
      ? await backupSnapshot(rows, "changeset", options.reason)
      : undefined
    if (!options.checkpoint) await ensureModelCheckpointLocked()
    const targets: Record<string, { key: string; value: unknown }[]> = {
      dashboards: next.boards.map((b) => ({
        key: b.dashboard.id,
        value: b.dashboard,
      })),
      columns: next.boards.flatMap((b) =>
        b.columns.map((c) => ({ key: c.id, value: c }))
      ),
      cards: next.boards.flatMap((b) =>
        b.cards.map((c) => ({ key: c.id, value: c }))
      ),
      sidebar: [
        {
          key: "layout",
          value: {
            ...(next.workspace?.sidebar ?? {
              id: "layout",
              items: [],
              updatedAt: Date.now(),
              deletedAt: null,
            }),
            workspaces: next.organization?.workspaces ?? [
              { id: "default", title: t("Личное пространство") },
            ],
          },
        },
      ],
      history: (next.workspace?.history ?? []).map((entry) => ({
        key: entry.id,
        value: entry,
      })),
    }
    for (const store of ["dashboards", "columns", "cards", "history"]) {
      const ids = new Set(targets[store].map((row) => row.key))
      if (rows[store].some((row) => !ids.has(row.key)))
        throw new Error("Commands cannot delete source records")
    }
    const writes: DataWrite[] = []
    if (next.calendar)
      targets.meta = [{ key: "bordena:calendar", value: next.calendar }]
    for (const [store, values] of Object.entries(targets)) {
      const previous = new Map(rows[store].map((row) => [row.key, row.value]))
      for (const row of values)
        if (JSON.stringify(previous.get(row.key)) !== JSON.stringify(row.value))
          writes.push({
            store,
            key: row.key,
            before: previous.get(row.key),
            after: row.value,
            source: "command",
          })
    }
    const database = await webDb.open()
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(
        [...new Set([...Object.keys(targets), "meta"])],
        "readwrite",
        { durability: "strict" }
      )
      let failure: unknown
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () =>
        reject(failure ?? tx.error ?? new Error("Command transaction failed"))
      try {
        for (const write of writes)
          tx.objectStore(write.store).put(write.after, write.key)
        tx.objectStore("meta").put(
          {
            extensions: next.extensions,
            boards: Object.fromEntries(
              next.boards.map((board) => [board.dashboard.id, board.extensions])
            ),
          },
          "bordena:exchange"
        )
        tx.objectStore("meta").put(6, "bordena:model-revision")
        const latest = Math.max(
          Date.now(),
          ...next.boards.flatMap((board) => [
            board.dashboard.updatedAt,
            ...board.columns.map((column) => column.updatedAt),
            ...board.cards.map((card) => card.updatedAt),
          ])
        )
        tx.objectStore("meta").put(latest, "hlc:last")
      } catch (error) {
        failure = error
        tx.abort()
      }
    })
    return { token: await stateToken(await snapshot()), backup, writes }
  })
  for (const write of result.writes) notifyDataWrite(write)
  if (typeof window !== "undefined") {
    const channel = new BroadcastChannel("bordena-linked-progress-v1")
    channel.postMessage("workspace")
    channel.close()
  }
  return result
}
/** No async work inside the readwrite transaction; all validation precedes it. */
export async function applyImport(
  payload: ImportPayload,
  mode: "add" | "replace",
  expected: ImportPreview,
  options?: { kind?: BackupRecord["kind"]; reason?: string }
): Promise<{ token: string; backup?: BackupRecord }> {
  await flushCardEdits()
  return withDataLock(async () => {
    const document = validateDocument(payload.document)
    // Revalidate bytes as well: the preview must never authorize an altered payload.
    await decodeImport(await encodeArchive(payload))
    const rows = await snapshot()
    const current = await previewFor(payload, rows)
    if (expected.token !== current.token)
      throw new Error(
        t("Данные изменились после просмотра. Выберите файл заново")
      )
    if (mode === "add" && current.conflicts)
      throw new Error(
        t("Конфликт ID: добавление отменено без изменения данных")
      )
    if (mode === "replace" && document.scope !== "workspace")
      throw new Error(t("Для замены требуется экспорт всего пространства"))
    const backup =
      mode === "replace"
        ? await backupSnapshot(
            rows,
            options?.kind ?? "automatic",
            options?.reason ?? "Перед восстановлением"
          )
        : undefined
    const epoch =
      ((rows.meta.find((x) => x.key === "bordena:epoch")?.value as number) ??
        0) + 1
    const db = await webDb.open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES, "readwrite", { durability: "strict" })
      try {
        if (mode === "replace")
          for (const store of STORES) tx.objectStore(store).clear()
        let last =
          rows.dashboards
            .map((x) => (x.value as Dashboard).position)
            .sort()
            .at(-1) ?? null
        for (const board of document.boards) {
          const dashboard = { ...board.dashboard }
          if (mode === "add") {
            dashboard.position = generateKeyBetween(last, null)
            last = dashboard.position
          }
          tx.objectStore("dashboards").put(dashboard, dashboard.id)
          for (const col of board.columns)
            tx.objectStore("columns").put(col, col.id)
          for (const card of board.cards)
            tx.objectStore("cards").put(card, card.id)
        }
        for (const att of document.attachmentsManifest)
          tx.objectStore(BLOBS).put(
            payload.files.get(att.path),
            blobKey(att.cardId, att.key)
          )
        for (const history of document.workspace?.history ?? [])
          tx.objectStore("history").put(history, history.id)
        const oldSidebar = rows.sidebar.find((x) => x.key === "layout")
          ?.value as SidebarLayout | undefined
        const incomingSpaces = document.organization?.workspaces ??
          document.workspace?.sidebar?.workspaces ?? [
            { id: "default", title: t("Личное пространство") },
          ]
        const oldSpaces = oldSidebar?.workspaces?.length
          ? oldSidebar.workspaces
          : [{ id: "default", title: t("Личное пространство") }]
        const workspaces =
          mode === "replace"
            ? incomingSpaces
            : [
                ...oldSpaces,
                ...incomingSpaces.filter(
                  (space) => !oldSpaces.some((old) => old.id === space.id)
                ),
              ]
        const incomingItems =
          document.workspace?.sidebar?.items ??
          document.boards.map((b) => ({
            type: "board" as const,
            id: b.dashboard.id,
          }))
        const oldFolderIds = new Set(
          oldSidebar?.items.filter((i) => i.type === "folder").map((i) => i.id)
        )
        // Folder IDs are navigation metadata. Merge colliding folders only inside the same workspace.
        const additions: SidebarLayout["items"] = []
        const mergedOld = (oldSidebar?.items ?? []).map((item) => {
          const incoming = incomingItems.find(
            (i) => i.type === "folder" && i.id === item.id
          )
          if (item.type !== "folder" || incoming?.type !== "folder") return item
          if (
            mode === "add" &&
            (item.workspaceId ?? "default") !==
              (incoming.workspaceId ?? "default")
          )
            throw new Error(t("Конфликт ID проекта"))
          return { ...item, boardIds: [...item.boardIds, ...incoming.boardIds] }
        })
        for (const item of incomingItems)
          if (item.type !== "folder" || !oldFolderIds.has(item.id))
            additions.push(item)
        const sidebar: SidebarLayout =
          mode === "replace"
            ? (document.workspace?.sidebar ?? {
                id: "layout",
                items: [],
                updatedAt: Date.now(),
                deletedAt: null,
              })
            : {
                id: "layout",
                items: [...mergedOld, ...additions],
                templates: oldSidebar?.templates,
                updatedAt: Date.now(),
                deletedAt: null,
              }
        if (mode === "add" && document.workspace?.sidebar?.templates) {
          const templates = new Map(
            (sidebar.templates ?? []).map((template) => [template.id, template])
          )
          for (const template of document.workspace.sidebar.templates) {
            const existing = templates.get(template.id)
            if (
              existing &&
              JSON.stringify(existing) !== JSON.stringify(template)
            )
              throw new Error("Template ID conflict")
            templates.set(template.id, template)
          }
          sidebar.templates = [...templates.values()]
        }
        tx.objectStore("sidebar").put({ ...sidebar, workspaces }, "layout")
        const previous = rows.meta.find((x) => x.key === "bordena:exchange")
          ?.value as
          | {
              boards?: object
            }
          | undefined
        tx.objectStore("meta").put(
          {
            extensions: document.extensions,
            boards: {
              ...(mode === "add" ? previous?.boards : {}),
              ...Object.fromEntries(
                document.boards.map((b) => [b.dashboard.id, b.extensions])
              ),
            },
          },
          "bordena:exchange"
        )
        tx.objectStore("meta").put(true, "bordena:initialized")
        if (document.calendar) {
          const old =
            (rows.meta.find((row) => row.key === "bordena:calendar")?.value as
              CalendarState | undefined) ?? emptyCalendarState()
          const merged =
            mode === "replace"
              ? document.calendar
              : CalendarStateSchema.parse({
                  ...old,
                  updatedAt: Date.now(),
                  calendars: [...old.calendars, ...document.calendar.calendars],
                  events: [...old.events, ...document.calendar.events],
                  profiles: [...old.profiles, ...document.calendar.profiles],
                })
          tx.objectStore("meta").put(merged, "bordena:calendar")
        }
        tx.objectStore("meta").put(
          document.schemaVersion >= 6
            ? 6
            : document.schemaVersion >= 5
              ? 5
              : document.schemaVersion >= 4
                ? 4
                : 3,
          "bordena:model-revision"
        )
        tx.objectStore("meta").put(epoch, "bordena:epoch")
        const maxStamp = Math.max(
          Date.now(),
          ...document.boards.flatMap((b) => [
            b.dashboard.updatedAt,
            ...b.columns.map((c) => c.updatedAt),
            ...b.cards.map((c) => c.updatedAt),
          ])
        )
        tx.objectStore("meta").put(maxStamp, "hlc:last")
        tx.oncomplete = () => resolve()
        tx.onerror = tx.onabort = () =>
          reject(
            new Error(
              t(
                "Импорт не записан. Транзакция отменена, прежние данные сохранены"
              )
            )
          )
      } catch {
        tx.abort()
        reject(new Error(t("Импорт отменён до записи")))
      }
    })
    if (mode === "replace") {
      const restoredPreferences = document.preferences ?? preferencesSnapshot()
      const spaces = document.organization?.workspaces ??
        document.workspace?.sidebar?.workspaces ?? [{ id: "default" }]
      setPreferences({
        ...restoredPreferences,
        workspaceId: spaces.some(
          (space) => space.id === restoredPreferences.workspaceId
        )
          ? restoredPreferences.workspaceId
          : spaces[0].id,
      })
    }
    return { token: await stateToken(await snapshot()), backup }
  })
}
