import { t } from "@bordena/i18n"
import { generateKeyBetween } from "fractional-indexing"
import type { BoardLayout } from "./board-layout"
import type { Card, Column } from "./types"
import { byPosition } from "./utils/position"
export function sectionPlacement(layout: BoardLayout, column: Column) {
  const stored = layout.sections[column.id]
  return {
    ...stored,
    laneId: stored?.laneId ?? layout.lanes[0].id,
    stageId: stored?.stageId ?? layout.stages[0].id,
    stateId: stored?.stateId ?? layout.states[0].id,
    collapsed: stored?.collapsed ?? false,
    position: stored?.position ?? column.position,
    progressMode: stored?.progressMode ?? "off",
  }
}
export function sectionProgressValues(
  cards: Card[],
  layout?: BoardLayout
): Map<string, number | null> {
  const values = new Map<string, number | null>(),
    groups = new Map<string, Card[]>()
  for (const card of cards) {
    if (card.deletedAt) continue
    const group = groups.get(card.columnId) ?? []
    group.push(card)
    groups.set(card.columnId, group)
  }
  for (const [id, group] of groups) {
    const mode = layout?.sections[id]?.progressMode ?? "off"
    if (mode === "position")
      group.sort((a, b) => byPosition(a, b) || a.id.localeCompare(b.id))
    group.forEach((card, i) =>
      values.set(
        card.id,
        mode === "off"
          ? null
          : mode === "manual"
            ? (card.progress ?? null)
            : group.length < 2
              ? null
              : Math.round((100 * i) / (group.length - 1))
      )
    )
  }
  return values
}
export function sectionsInLane(
  layout: BoardLayout,
  columns: Column[],
  laneId: string
): Column[] {
  return columns
    .filter(
      (c) => !c.deletedAt && sectionPlacement(layout, c).laneId === laneId
    )
    .sort(
      (a, b) =>
        byPosition(sectionPlacement(layout, a), sectionPlacement(layout, b)) ||
        a.id.localeCompare(b.id)
    )
}
/** Only placement metadata changes: card IDs, bodies, axes and attachment keys stay untouched. */
export function moveSection(
  layout: BoardLayout,
  columns: Column[],
  id: string,
  laneId: string,
  index: number
): BoardLayout {
  const column = columns.find((c) => c.id === id && !c.deletedAt)
  if (
    !column ||
    !layout.lanes.some((l) => l.id === laneId) ||
    !Number.isInteger(index) ||
    index < 0
  )
    throw new Error(t("Недопустимое перемещение секции"))
  const target = sectionsInLane(layout, columns, laneId).filter(
    (c) => c.id !== id
  )
  const at = Math.min(index, target.length)
  const before = target[at - 1],
    after = target[at]
  const position = generateKeyBetween(
    before ? sectionPlacement(layout, before).position : null,
    after ? sectionPlacement(layout, after).position : null
  )
  return {
    ...layout,
    sections: {
      ...layout.sections,
      [id]: { ...sectionPlacement(layout, column), laneId, position },
    },
  }
}
/** A positional percentage is a presentation value and never overwrites Card.progress. */
export function sectionProgress(
  card: Card,
  cards: Card[],
  mode: "off" | "manual" | "position"
): number | null {
  if (mode === "off") return null
  if (mode === "manual") return card.progress ?? null
  const sequence = cards
    .filter((c) => !c.deletedAt && c.columnId === card.columnId)
    .sort((a, b) => byPosition(a, b) || a.id.localeCompare(b.id))
  if (sequence.length < 2) return null
  const index = sequence.findIndex((c) => c.id === card.id)
  return index < 0 ? null : Math.round((100 * index) / (sequence.length - 1))
}
