import type { Card, Column, Dashboard } from "./types"
import { goalProgress } from "./goal-path"
import { cardAxes, isCardCompleted } from "./board-layout"
import { validDeadline } from "@bordena/contract"
import { generateKeyBetween } from "fractional-indexing"

export type BoardLink = NonNullable<Card["boardLink"]>
export interface LinkedModel {
  archivedBoardIds?: string[]
  dashboards: Dashboard[]
  columns: Column[]
  cards: Card[]
}
export type ProgressResult = NonNullable<Card["linkedProgress"]>
const live = <T extends { deletedAt: number | null }>(x: T) =>
  x.deletedAt === null

/** Validate the entire graph, including navigation edges. Missing targets stay readable. */
export function validateLinks(model: LinkedModel): void {
  const columns = new Map(model.columns.map((c) => [c.id, c]))
  const edges = new Map<string, string[]>()
  for (const card of model.cards.filter(live)) {
    const link = card.boardLink
    if (!link) continue
    const parent = columns.get(card.columnId)?.dashboardId
    if (!parent) throw new Error("Link parent is unavailable")
    edges.set(parent, [...(edges.get(parent) ?? []), link.boardId])
    const board = model.dashboards.find((b) => b.id === parent)
    if (link.mode === "auto-move") {
      const sorted = [...link.rules].sort((a, b) => a.min - b.min)
      if (!sorted.length) throw new Error("Auto move requires progress ranges")
      let end = -1
      for (const rule of sorted) {
        if (rule.min > rule.max || rule.min <= end)
          throw new Error("Progress ranges overlap or are reversed")
        if (link.requireFullCoverage && rule.min !== end + 1)
          throw new Error("Progress ranges must cover 0–100")
        if (!board?.layout?.stages.some((s) => s.id === rule.stageId))
          throw new Error("Target stage is unavailable")
        if (
          rule.columnId &&
          !model.columns.some(
            (c) => c.id === rule.columnId && c.dashboardId === parent && live(c)
          )
        )
          throw new Error("Target section is unavailable")
        end = rule.max
      }
      if (link.requireFullCoverage && end !== 100)
        throw new Error("Progress ranges must cover 0–100")
    }
    const source = model.dashboards.find(
      (b) => b.id === link.boardId && live(b)
    )
    // Deleted/missing sources are legal unavailable links, never silently removed.
    if (!source) continue
    const ownCols = model.columns.filter(
      (c) => c.dashboardId === source.id && live(c)
    )
    const ownIds = new Set(ownCols.map((c) => c.id))
    if (
      link.source.cardIds?.some(
        (id) => !model.cards.some((c) => c.id === id && ownIds.has(c.columnId))
      )
    )
      throw new Error("Selected card is outside the linked board")
    if (
      [
        ...(link.source.sectionIds ?? []),
        ...(link.source.completedColumnIds ?? []),
      ].some(
        (id) =>
          !model.columns.some((c) => c.id === id && c.dashboardId === source.id)
      )
    )
      throw new Error("Selected section is outside the linked board")
    if (
      link.source.completedStateIds?.some(
        (id) => !source.layout?.states.some((s) => s.id === id)
      )
    )
      throw new Error("Completion state is unavailable")
    if (
      link.source.stageValues?.some(
        (x) => !source.layout?.stages.some((s) => s.id === x.id)
      ) ||
      new Set(link.source.stageValues?.map((x) => x.id)).size !==
        (link.source.stageValues?.length ?? 0)
    )
      throw new Error("Stage progress configuration is invalid")
  }
  const visiting = new Set<string>(),
    done = new Set<string>()
  // Iterative DFS avoids stack overflow with large imported graphs.
  for (const start of edges.keys()) {
    if (done.has(start)) continue
    const stack: { id: string; exit: boolean }[] = [{ id: start, exit: false }]
    while (stack.length) {
      const node = stack.pop()!
      if (node.exit) {
        visiting.delete(node.id)
        done.add(node.id)
        continue
      }
      if (visiting.has(node.id)) throw new Error("Cyclic board dependency")
      if (done.has(node.id)) continue
      visiting.add(node.id)
      stack.push({ ...node, exit: true })
      for (const next of edges.get(node.id) ?? [])
        stack.push({ id: next, exit: false })
    }
  }
}

/** Integers use inclusive ranges (0–19, 20–49 …). Manual card percentages are untouched. */
export function linkedProgress(
  model: LinkedModel,
  link: BoardLink
): ProgressResult {
  const board = model.dashboards.find((b) => b.id === link.boardId && live(b))
  if (!board) return { value: null, reason: "missing" }
  if (link.source.type === "goal") {
    const value = goalProgress(board.goalPath)
    return { value, reason: value === null ? "unset" : "available" }
  }
  if (link.source.type === "manual")
    return {
      value: board.progress ?? null,
      reason: board.progress == null ? "unset" : "available",
    }
  const columns = model.columns.filter(
    (c) => c.dashboardId === board.id && live(c)
  )
  const ids = new Set(columns.map((c) => c.id))
  const hasSelection =
    !!link.source.cardIds?.length || !!link.source.sectionIds?.length
  const cards = model.cards.filter(
    (c) =>
      live(c) &&
      ids.has(c.columnId) &&
      (!hasSelection ||
        link.source.cardIds?.includes(c.id) ||
        link.source.sectionIds?.includes(c.columnId))
  )
  if (!cards.length) return { value: null, reason: "empty" }
  let values: (number | null | undefined)[]
  if (link.source.type === "tasks") {
    const configured =
      !!link.source.completedColumnIds?.length ||
      !!link.source.completedStateIds?.length
    const doneColumns = new Set(
      configured
        ? (link.source.completedColumnIds ?? [])
        : columns.filter((c) => c.done).map((c) => c.id)
    )
    values = cards.map((c) =>
      (!configured
        ? isCardCompleted(
            c,
            columns.find((col) => col.id === c.columnId),
            board.layout
          )
        : doneColumns.has(c.columnId)) ||
      (board.layout &&
        link.source.completedStateIds?.includes(
          cardAxes(c, board.layout).stateId
        ))
        ? 100
        : 0
    )
  } else if (link.source.type === "stages") {
    if (!board.layout || !link.source.stageValues?.length)
      return { value: null, reason: "unset" }
    const stageValues = new Map(
      link.source.stageValues.map((s) => [s.id, s.value])
    )
    values = cards.map((c) =>
      stageValues.get(cardAxes(c, board.layout!).stageId)
    )
  } else
    values = cards.map((c) =>
      c.boardLink && c.boardLink.mode !== "navigation"
        ? c.linkedProgress?.value
        : c.progress
    )
  if (values.some((v) => v == null)) return { value: null, reason: "unset" }
  const average =
    (values as number[]).reduce((sum, v) => sum + v, 0) / values.length
  return {
    value: average >= 100 ? 100 : Math.min(99, Math.round(average)),
    reason: "available",
  }
}

/** Only dependencies of changed boards are recalculated. Returned writes are semantically different. */
export function synchronizeLinks(
  model: LinkedModel,
  changedBoards: Iterable<string>
): {
  cards: Card[]
  moves: {
    cardId: string
    fromStage?: string
    toStage: string
    columnId?: string
    progress: number
  }[]
} {
  validateLinks(model)
  const cards = new Map(model.cards.map((c) => [c.id, { ...c }]))
  const parentOf = new Map(model.columns.map((c) => [c.id, c.dashboardId]))
  const dependents = new Map<string, Card[]>()
  for (const card of model.cards.filter(live))
    if (card.boardLink)
      dependents.set(card.boardLink.boardId, [
        ...(dependents.get(card.boardLink.boardId) ?? []),
        card,
      ])
  const queue = [...new Set(changedBoards)],
    changed = new Map<string, Card>(),
    moves: ReturnType<typeof synchronizeLinks>["moves"] = []
  const children = new Map<string, string[]>()
  for (const card of model.cards.filter(live))
    if (card.boardLink) {
      const parent = parentOf.get(card.columnId)
      if (parent)
        children.set(parent, [
          ...(children.get(parent) ?? []),
          card.boardLink.boardId,
        ])
    }
  const visited = new Set<string>(),
    order = new Map<string, number>()
  for (const board of model.dashboards) {
    const stack: { id: string; exit: boolean }[] = [
      { id: board.id, exit: false },
    ]
    while (stack.length) {
      const node = stack.pop()!
      if (node.exit) {
        order.set(node.id, order.size)
        continue
      }
      if (visited.has(node.id)) continue
      visited.add(node.id)
      stack.push({ ...node, exit: true })
      for (const child of children.get(node.id) ?? [])
        if (!visited.has(child)) stack.push({ id: child, exit: false })
    }
  }
  let iterations = 0
  while (queue.length) {
    queue.sort((a, b) => (order.get(a) ?? -1) - (order.get(b) ?? -1))
    if (
      ++iterations >
      Math.max(100, model.cards.length * model.dashboards.length + 1)
    )
      throw new Error("Dependency propagation limit exceeded")
    const boardId = queue.shift()!
    for (const dependent of dependents.get(boardId) ?? []) {
      const current = cards.get(dependent.id)!,
        link = current.boardLink!
      const next = { ...current }
      if (link.mode === "navigation") {
        if (!current.linkedProgress) continue
        delete next.linkedProgress
      } else {
        const result = linkedProgress(
          { ...model, cards: [...cards.values()] },
          link
        )
        next.linkedProgress = result
        const parentId = parentOf.get(current.columnId),
          parent = model.dashboards.find((b) => b.id === parentId)
        const archived =
          current.archived ||
          parent?.archived ||
          (!!parentId && model.archivedBoardIds?.includes(parentId))
        if (archived && current.linkedProgress?.moveKey)
          next.linkedProgress = {
            ...result,
            moveKey: current.linkedProgress.moveKey,
          }
        if (link.mode === "auto-move" && !archived && result.value !== null) {
          const rule = link.rules.find(
            (r) => result.value! >= r.min && result.value! <= r.max
          )
          const moveKey = rule
            ? JSON.stringify([
                link.boardId,
                link.source.type,
                rule,
                result.value,
              ])
            : undefined
          if (moveKey) next.linkedProgress = { ...result, moveKey }
          if (rule && moveKey !== current.linkedProgress?.moveKey) {
            next.stageId = rule.stageId
            if (rule.columnId && rule.columnId !== current.columnId) {
              next.columnId = rule.columnId
              const last =
                [...cards.values()]
                  .filter(
                    (c) =>
                      live(c) &&
                      c.id !== current.id &&
                      c.columnId === rule.columnId
                  )
                  .map((c) => c.position)
                  .sort()
                  .at(-1) ?? null
              next.position = generateKeyBetween(last, null)
            }
            if (
              current.stageId !== next.stageId ||
              current.columnId !== next.columnId
            )
              moves.push({
                cardId: current.id,
                fromStage: current.stageId,
                toStage: rule.stageId,
                columnId: rule.columnId,
                progress: result.value,
              })
          }
        }
      }
      if (
        JSON.stringify(current.linkedProgress) ===
          JSON.stringify(next.linkedProgress) &&
        current.stageId === next.stageId &&
        current.columnId === next.columnId
      )
        continue
      cards.set(next.id, next)
      changed.set(next.id, next)
      const parent = parentOf.get(next.columnId)
      if (parent && !queue.includes(parent)) queue.push(parent)
    }
  }
  return { cards: [...changed.values()], moves }
}

export function validateFieldValues(
  card: Card,
  definitions: NonNullable<Dashboard["fieldDefinitions"]>
): void {
  for (const [id, value] of Object.entries(card.fieldValues ?? {})) {
    const field = definitions.find((f) => f.id === id)
    if (!field) throw new Error("Unknown custom field")
    if (value == null) continue
    if (field.type === "text" && typeof value === "string") continue
    if (
      field.type === "date" &&
      typeof value === "string" &&
      value.length === 10 &&
      validDeadline(value)
    )
      continue
    if (field.type === "checkbox" && typeof value === "boolean") continue
    if (
      field.type === "select" &&
      typeof value === "string" &&
      field.options?.includes(value)
    )
      continue
    if (
      ["number", "percent"].includes(field.type) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      (field.type !== "percent" || (value >= 0 && value <= 100))
    )
      continue
    throw new Error("Invalid custom field value")
  }
}
