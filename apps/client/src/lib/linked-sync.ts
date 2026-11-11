import {
  CardSchema,
  DashboardSchema,
  CARD_FIELD_GROUP,
  type Card,
  type Column,
  type Dashboard,
  type SidebarLayout,
  CalendarStateSchema,
  emptyCalendarState,
  type CalendarState,
} from "@bordena/contract"
import {
  queryClient,
  keys,
  stamp,
  reconcileAutomation,
  nextAutomationDeadline,
  archivedAutomationBoards,
  CALENDAR_KEY,
  planCalendar,
  nextCalendarDeadline,
} from "@bordena/core"
import {
  webDb,
  subscribeDataWrites,
  type DataWrite,
  notifyDataWrite,
  currentDataGeneration,
} from "./adapters/web-db"

import { ensureModelCheckpointLocked } from "./exchange/workspace"
import { recordStructuralBatch, recordCommand } from "./structural-history"

let coordinatorOwner = true
let calendarChecklistIds = new Set<string>()
let sidebar: SidebarLayout | undefined
let cache:
  { dashboards: Dashboard[]; columns: Column[]; cards: Card[] } | undefined
let cacheGeneration = -1
let deadlineTimer: ReturnType<typeof setTimeout> | undefined
function scheduleDeadline(cards: Card[], calendar?: CalendarState) {
  if (deadlineTimer) clearTimeout(deadlineTimer)
  const now = Date.now(),
    deadlines = [
      nextAutomationDeadline(cards, now),
      calendar ? nextCalendarDeadline(calendar, now) : null,
    ].filter((v): v is number => v !== null),
    next = deadlines.length ? Math.min(...deadlines) : null
  if (next !== null)
    deadlineTimer = setTimeout(
      () => requestLinkedSync("*"),
      Math.min(2147483647, Math.max(1, next - now + 1))
    )
}
const selected = (store: string, value: unknown) => {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const names =
    store === "cards"
      ? [
          "columnId",
          "stageId",
          "stateId",
          "progress",
          "linkedProgress",
          "boardLink",
          "calendarId",
          "deletedAt",
          "deadline",
          "archived",
          "automationRules",
          ...(((v.automationRules as Card["automationRules"]) ?? []).some(
            (r) => r.condition.type === "checklist-complete"
          ) || calendarChecklistIds.has(String(v.id))
            ? ["body"]
            : []),
        ]
      : store === "columns"
        ? ["dashboardId", "done", "deletedAt"]
        : ["layout", "progress", "goalPath", "archived", "deletedAt"]
  return JSON.stringify(Object.fromEntries(names.map((key) => [key, v[key]])))
}
let timer: ReturnType<typeof setTimeout> | undefined
let channel: BroadcastChannel | undefined
const pending = new Set<string>()
let running: Promise<void> | undefined
export async function flushLinkedSync(): Promise<void> {
  if (!coordinatorOwner) return
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  if (running) {
    await running
    if (pending.size) await flushLinkedSync()
    return
  }
  if (!pending.size) return
  const changed = [...pending]
  pending.clear()
  running = webDb
    .writeLocked(async () => {
      const generation = currentDataGeneration()
      if (cacheGeneration !== generation && cacheGeneration !== generation - 1)
        cache = undefined
      cacheGeneration = generation
      if (!cache) {
        const [dashboards, columns, cards] = await Promise.all([
          webDb.getAll<Dashboard>("dashboards"),
          webDb.getAll<Column>("columns"),
          webDb.getAll<Card>("cards"),
        ])
        sidebar = await webDb.get<SidebarLayout>("sidebar", "layout")
        cache = { dashboards, columns, cards }
      }
      const { dashboards, columns, cards } = cache
      const affected = changed.includes("*")
        ? dashboards.map((b) => b.id)
        : changed
            .map(
              (id) =>
                columns.find((c) => c.id === id)?.dashboardId ??
                cards.find((c) => c.id === id)?.columnId ??
                id
            )
            .map((id) => columns.find((c) => c.id === id)?.dashboardId ?? id)
      const plan = reconcileAutomation(
        {
          dashboards,
          columns,
          cards,
          archivedBoardIds: archivedAutomationBoards(dashboards, sidebar),
        },
        Date.now(),
        affected
      )
      const calendar = CalendarStateSchema.parse(
        (await webDb.get("meta", CALENDAR_KEY)) ?? emptyCalendarState()
      )
      calendarChecklistIds = new Set(
        calendar.events.flatMap((e) =>
          e.links.flatMap((l) =>
            l.type === "checklist" && l.cardId ? [l.cardId] : []
          )
        )
      )
      const calendarChanges = planCalendar(
        calendar,
        {
          cards: cards.map((c) => plan.cards.find((p) => p.id === c.id) ?? c),
          dashboards: dashboards.map(
            (b) => plan.dashboards.find((p) => p.id === b.id) ?? b
          ),
          columns,
          sidebar,
        },
        Date.now()
      )
      const nextCalendar = calendarChanges.length
        ? {
            ...calendar,
            updatedAt: Date.now(),
            events: calendar.events.map(
              (e) => calendarChanges.find((c) => c.id === e.id)?.after ?? e
            ),
          }
        : calendar
      scheduleDeadline(cards, nextCalendar)
      if (
        !plan.cards.length &&
        !plan.dashboards.length &&
        !calendarChanges.length
      )
        return
      await ensureModelCheckpointLocked()
      const writes: DataWrite[] = []
      const database = await webDb.open(),
        now = stamp()
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(
          ["cards", "dashboards", "history", "meta"],
          "readwrite",
          {
            durability: "strict",
          }
        )
        let failure: unknown
        try {
          if (calendarChanges.length) {
            tx.objectStore("meta").put(nextCalendar, CALENDAR_KEY)
            writes.push({
              store: "meta",
              key: CALENDAR_KEY,
              before: calendar,
              after: nextCalendar,
              source: "synchronization",
            })
            for (const change of calendarChanges) {
              const id = crypto.randomUUID()
              tx.objectStore("history").put(
                {
                  id,
                  boardId: "calendar",
                  entityId: change.id,
                  entityType: "card",
                  userId: null,
                  action: "move",
                  data: {
                    reason: "calendar",
                    title: change.after.title,
                    from: change.before.start,
                    to: change.after.start,
                    fromEnd: change.before.end,
                    toEnd: change.after.end,
                    result: change.after.execution?.result,
                    explanation: change.reason,
                    rule: change.before.reschedule ?? "calendar",
                  },
                  createdAt: now,
                  updatedAt: now,
                  deletedAt: null,
                },
                id
              )
            }
          }
          for (const card of plan.cards) {
            const next = CardSchema.parse({
              ...card,
              updatedAt: now,
              stamps: {
                ...card.stamps,
                ...Object.fromEntries(
                  Object.entries(CARD_FIELD_GROUP)
                    .filter(
                      ([field]) =>
                        JSON.stringify(card[field as keyof Card]) !==
                        JSON.stringify(
                          cards.find((c) => c.id === card.id)?.[
                            field as keyof Card
                          ]
                        )
                    )
                    .map(([, group]) => [group, now])
                ),
              },
            })
            tx.objectStore("cards").put(next, next.id)
            writes.push({
              store: "cards",
              key: next.id,
              before: cards.find((c) => c.id === next.id),
              after: next,
              source: "synchronization",
            })
          }
          for (const board of plan.dashboards) {
            const next = DashboardSchema.parse({ ...board, updatedAt: now })
            tx.objectStore("dashboards").put(next, next.id)
            writes.push({
              store: "dashboards",
              key: next.id,
              before: dashboards.find((b) => b.id === next.id),
              after: next,
              source: "synchronization",
            })
          }
          for (const event of plan.events) {
            const id = crypto.randomUUID()
            tx.objectStore("history").put(
              {
                id,
                boardId: event.boardId,
                entityId: event.cardId,
                entityType: "card",
                userId: null,
                action: "edit",
                data: {
                  ...event,
                  explanation: event.reason,
                  reason: "automation",
                },
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
              },
              id
            )
          }
          for (const move of plan.moves) {
            const id = crypto.randomUUID(),
              card = plan.cards.find((c) => c.id === move.cardId)!
            tx.objectStore("history").put(
              {
                id,
                boardId: columns.find((c) => c.id === card.columnId)!
                  .dashboardId,
                entityId: card.id,
                entityType: "card",
                userId: null,
                action: "move",
                data: { reason: "linked-board-progress", ...move },
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
              },
              id
            )
          }
        } catch (error) {
          failure = error
          tx.abort()
        }
        tx.oncomplete = () => resolve()
        tx.onabort = tx.onerror = () =>
          reject(
            failure ?? tx.error ?? new Error("Linked synchronization failed")
          )
      })
      const cardWrites = new Map(
        writes
          .filter((w) => w.store === "cards")
          .map((w) => [w.key, w.after as Card])
      )
      const boardWrites = new Map(
        writes
          .filter((w) => w.store === "dashboards")
          .map((w) => [w.key, w.after as Dashboard])
      )
      cache = {
        columns,
        cards: cards.map((c) => cardWrites.get(c.id) ?? c),
        dashboards: dashboards.map((b) => boardWrites.get(b.id) ?? b),
      }
      for (const write of writes) notifyDataWrite(write)
      recordStructuralBatch(writes)
      if (calendarChanges.length) {
        const expectedValues = new Map(
          calendarChanges.map((change) => [change.id, change.after])
        )
        const apply = async (direction: "undo" | "redo") => {
          const latest = CalendarStateSchema.parse(
            await webDb.get("meta", CALENDAR_KEY)
          )
          const operations = calendarChanges.map((change) => {
            const current = latest.events.find((e) => e.id === change.id),
              expected = expectedValues.get(change.id)!,
              target = direction === "undo" ? change.before : change.after
            if (
              !current ||
              JSON.stringify(current) !== JSON.stringify(expected)
            )
              throw new Error("Calendar changed after automatic scheduling")
            return {
              op: "update-calendar-event" as const,
              id: current.id,
              expectedUpdatedAt: current.updatedAt,
              event: {
                ...target,
                execution: current.execution
                  ? {
                      ...current.execution,
                      key: `${target.start}/${target.end}`,
                    }
                  : undefined,
              },
            }
          })
          await (
            await import("./exchange/changeset")
          ).applyOperations(operations)
          const saved = CalendarStateSchema.parse(
            await webDb.get("meta", CALENDAR_KEY)
          )
          for (const change of calendarChanges)
            expectedValues.set(
              change.id,
              saved.events.find((e) => e.id === change.id)!
            )
        }
        recordCommand({
          label: "Calendar",
          undo: () => apply("undo"),
          redo: () => apply("redo"),
        })
      }
      scheduleDeadline(cache!.cards, nextCalendar)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.boards }),
        queryClient.invalidateQueries({ queryKey: keys.cards }),
        queryClient.invalidateQueries({ queryKey: keys.activity }),
      ])
      channel?.postMessage("updated")
    })
    .catch((error) => {
      cache = undefined
      throw error
    })
    .finally(() => {
      running = undefined
    })
  await running
  if (pending.size) await flushLinkedSync()
}
export function requestLinkedSync(id = "*"): void {
  if (!coordinatorOwner) {
    channel?.postMessage({ type: "dirty", id })
    return
  }
  if (id === "*") cache = undefined
  pending.add(id)
  if (typeof window === "undefined") return
  if (!timer)
    timer = setTimeout(() => {
      timer = undefined
      void flushLinkedSync().catch((error) =>
        window.dispatchEvent(
          new CustomEvent("bordena:automation-error", {
            detail: error instanceof Error ? error.message : String(error),
          })
        )
      )
    }, 200)
}
export function installLinkedSync(ownsScheduling = true): () => void {
  coordinatorOwner = ownsScheduling
  channel = new BroadcastChannel("bordena-linked-progress-v1")
  channel.onmessage = (event) => {
    if (event.data?.type === "dirty") {
      cache = undefined
      void queryClient.invalidateQueries({ queryKey: ["calendar", "sources"] })
      if (coordinatorOwner) requestLinkedSync(event.data.id)
      return
    }
    if (event.data === "workspace") {
      void queryClient.invalidateQueries()
      if (coordinatorOwner) requestLinkedSync()
      return
    }
    cache = undefined
    void queryClient.invalidateQueries({ queryKey: ["calendar"] })
    void queryClient.invalidateQueries({ queryKey: keys.boards })
    void queryClient.invalidateQueries({ queryKey: keys.cards })
  }
  const unsubscribe = subscribeDataWrites((write: DataWrite) => {
    if (write.store === "meta" && write.key === CALENDAR_KEY) {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] })
      if (write.source !== "synchronization") requestLinkedSync()
      return
    }
    if (write.store === "sidebar") {
      requestLinkedSync()
      return
    }
    if (!["cards", "columns", "dashboards"].includes(write.store)) return
    if (
      !coordinatorOwner &&
      write.store === "cards" &&
      (write.before as Card | undefined)?.body !==
        (write.after as Card | undefined)?.body
    )
      requestLinkedSync(write.key)
    void queryClient.invalidateQueries({ queryKey: ["calendar", "sources"] })
    const generation = currentDataGeneration()
    if (cacheGeneration !== generation && cacheGeneration !== generation - 1)
      cache = undefined
    cacheGeneration = generation
    if (cache) {
      if (write.key === "*" || !write.after) cache = undefined
      else {
        const rows = cache[write.store as keyof typeof cache] as {
          id: string
        }[]
        const index = rows.findIndex((r) => r.id === write.key)
        if (index < 0) rows.push(write.after as { id: string })
        else rows[index] = write.after as { id: string }
      }
    }
    if (write.source === "synchronization") return
    if (
      write.before &&
      selected(write.store, write.before) === selected(write.store, write.after)
    )
      return
    requestLinkedSync(write.key === "*" ? "*" : write.key)
    const link = (write.after as Card | undefined)?.boardLink
    if (write.store === "cards" && link) requestLinkedSync(link.boardId)
  })
  const catchUp = () => {
    if (!document.hidden) requestLinkedSync()
  }
  window.addEventListener("focus", catchUp)
  document.addEventListener("visibilitychange", catchUp)
  requestLinkedSync()
  return () => {
    window.removeEventListener("focus", catchUp)
    document.removeEventListener("visibilitychange", catchUp)
    unsubscribe()
    channel?.close()
    if (timer) clearTimeout(timer)
    if (deadlineTimer) clearTimeout(deadlineTimer)
  }
}
