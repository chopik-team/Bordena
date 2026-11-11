import {
  flushCardEdits,
  queryClient,
  stamp,
  validateLinks,
  validateFieldValues,
  validateGoal,
  rebaseAutomationAfterUndo,
  type Card,
  type Column,
  type Dashboard,
} from "@bordena/core"
import { CARD_FIELD_GROUP, CardSchema } from "@bordena/contract"
import {
  webDb,
  subscribeDataWrites,
  type DataWrite,
  notifyDataWrite,
} from "./adapters/web-db"
import { requestLinkedSync } from "./linked-sync"
type Value = Record<string, unknown>
interface Delta {
  store: string
  id: string
  before: Value
  after: Value
}
interface Entry {
  deltas?: Delta[]
  undo?: () => Promise<void>
  redo?: () => Promise<void>
  label?: string
}
const undoStack: Entry[] = [],
  redoStack: Entry[] = []
let collecting: Delta[] = [],
  timer: ReturnType<typeof setTimeout> | undefined,
  applying = false
const LIMIT = 50
const allowed: Record<string, string[]> = {
  cards: [
    "title",
    "columnId",
    "position",
    "stageId",
    "stateId",
    "deadline",
    "priority",
    "progress",
    "boardLink",
    "fieldValues",
    "automationRules",
    "archived",
    "deletedAt",
  ],
  columns: ["title", "position", "collapsed", "color", "done", "deletedAt"],
  dashboards: [
    "title",
    "layout",
    "goalPath",
    "progress",
    "archived",
    "color",
    "priority",
    "deadline",
    "fieldDefinitions",
    "mirrors",
    "tableFields",
    "deletedAt",
  ],
  sidebar: ["items", "workspaces"],
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)
function collect(write: DataWrite): void {
  if (
    applying ||
    write.source ||
    !write.before ||
    !write.after ||
    !allowed[write.store]
  )
    return
  const before = write.before as Value,
    after = write.after as Value
  const fields = allowed[write.store].filter(
    (key) => !equal(before[key], after[key])
  )
  if (!fields.length) return
  const existing = collecting.find(
    (d) => d.store === write.store && d.id === write.key
  )
  const delta = existing ?? {
    store: write.store,
    id: write.key,
    before: {},
    after: {},
  }
  for (const field of fields) {
    if (!(field in delta.before))
      delta.before[field] = structuredClone(before[field])
    delta.after[field] = structuredClone(after[field])
  }
  if (!existing) collecting.push(delta)
  redoStack.length = 0
  if (timer) clearTimeout(timer)
  timer = setTimeout(commitPendingHistory, 100)
}
export function commitPendingHistory(): void {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  if (!collecting.length) return
  undoStack.push({ deltas: collecting })
  collecting = []
  if (undoStack.length > LIMIT) undoStack.shift()
}
export function recordStructuralBatch(writes: DataWrite[]): void {
  if (applying) return
  commitPendingHistory()
  for (const write of writes) collect({ ...write, source: undefined })
  commitPendingHistory()
}
export function recordCommand(
  entry: Required<Pick<Entry, "undo" | "redo">> & { label?: string }
): void {
  if (applying) return
  commitPendingHistory()
  undoStack.push(entry)
  redoStack.length = 0
  if (undoStack.length > LIMIT) undoStack.shift()
}
async function applyDeltas(
  deltas: Delta[],
  direction: "undo" | "redo"
): Promise<void> {
  await webDb.writeLocked(async () => {
    const [dashboards, columns, cards] = await Promise.all([
      webDb.getAll<Dashboard>("dashboards"),
      webDb.getAll<Column>("columns"),
      webDb.getAll<Card>("cards"),
    ])
    const patch = <T extends { id: string }>(store: string, values: T[]): T[] =>
      values.map((value) => {
        const delta = deltas.find((d) => d.store === store && d.id === value.id)
        return delta
          ? { ...value, ...(direction === "undo" ? delta.before : delta.after) }
          : value
      })
    const hypothetical = {
      dashboards: patch("dashboards", dashboards),
      columns: patch("columns", columns),
      cards: patch("cards", cards),
    }
    validateLinks(hypothetical)
    for (const board of hypothetical.dashboards) validateGoal(board)
    for (const card of hypothetical.cards)
      if (!card.deletedAt && deltas.some((d) => d.id === card.id)) {
        const parent = hypothetical.columns.find((c) => c.id === card.columnId)
        validateFieldValues(
          card,
          hypothetical.dashboards.find((b) => b.id === parent?.dashboardId)
            ?.fieldDefinitions ?? []
        )
      }
    const rebased = new Map(
      rebaseAutomationAfterUndo(
        hypothetical,
        stamp(),
        new Set(deltas.map((d) => d.id))
      ).map((c) => [c.id, c])
    )
    const writes: DataWrite[] = []
    const db = await webDb.open(),
      stores = [
        ...new Set([
          ...deltas.map((d) => d.store),
          ...(rebased.size ? ["cards"] : []),
        ]),
      ]
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, "readwrite", { durability: "strict" })
      let remaining = deltas.length,
        failure: unknown
      const found = new Map<Delta, Value>()
      const apply = () => {
        if (--remaining > 0) return
        try {
          // All comparisons precede every write in this transaction.
          for (const delta of deltas) {
            const current = found.get(delta)
            if (!current) throw new Error("History target is unavailable")
            const expected = direction === "undo" ? delta.after : delta.before
            for (const [key, value] of Object.entries(expected))
              if (!equal(current[key], value))
                throw new Error(
                  "History conflict: data changed after this action"
                )
          }
          const now = stamp()
          for (const delta of deltas) {
            const current = found.get(delta)!,
              values = direction === "undo" ? delta.before : delta.after
            let next = { ...current, ...values, updatedAt: now }
            if (delta.store === "cards" && rebased.has(delta.id))
              Object.assign(next, {
                automationState: rebased.get(delta.id)!.automationState,
              })
            if (delta.store === "cards") {
              const groups = Object.keys(values)
                .map(
                  (field) =>
                    CARD_FIELD_GROUP[field as keyof typeof CARD_FIELD_GROUP]
                )
                .filter(Boolean)
              next = CardSchema.parse({
                ...next,
                stamps: {
                  ...(current.stamps as object),
                  ...Object.fromEntries(groups.map((group) => [group, now])),
                },
              })
            }
            tx.objectStore(delta.store).put(next, delta.id)
            writes.push({
              store: delta.store,
              key: delta.id,
              before: current,
              after: next,
              source: "synchronization",
            })
          }
          for (const [id, card] of rebased) {
            if (deltas.some((d) => d.store === "cards" && d.id === id)) continue
            const next = CardSchema.parse({
              ...card,
              updatedAt: now,
              stamps: { ...card.stamps, automation: now },
            })
            tx.objectStore("cards").put(next, id)
            writes.push({
              store: "cards",
              key: id,
              before: cards.find((c) => c.id === id),
              after: next,
              source: "synchronization",
            })
          }
        } catch (error) {
          failure = error
          tx.abort()
        }
      }
      for (const delta of deltas) {
        const request = tx.objectStore(delta.store).get(delta.id)
        request.onsuccess = () => {
          found.set(delta, request.result)
          apply()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () =>
        reject(failure ?? tx.error ?? new Error("History transaction failed"))
    })
    for (const write of writes) notifyDataWrite(write)
  })
  requestLinkedSync()
  await queryClient.invalidateQueries()
}
export async function historyAction(
  direction: "undo" | "redo"
): Promise<boolean> {
  await flushCardEdits()
  commitPendingHistory()
  if (applying) return false
  const from = direction === "undo" ? undoStack : redoStack,
    to = direction === "undo" ? redoStack : undoStack,
    entry = from.at(-1)
  if (!entry) return false
  applying = true
  try {
    if (entry.deltas) await applyDeltas(entry.deltas, direction)
    else await entry[direction]!()
    from.pop()
    to.push(entry)
    return true
  } finally {
    applying = false
  }
}
export function installStructuralHistory(): () => void {
  return subscribeDataWrites(collect)
}
export function resetStructuralHistory(): void {
  undoStack.length = 0
  redoStack.length = 0
  collecting = []
  if (timer) clearTimeout(timer)
  timer = undefined
}
