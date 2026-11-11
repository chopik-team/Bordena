import { t } from "@bordena/i18n"
import { BoardLayoutSchema } from "@bordena/contract"
import { generateKeyBetween } from "fractional-indexing"
import type { Card, Column, Dashboard } from "./types"
export type BoardLayout = NonNullable<Dashboard["layout"]>
export type LayoutMode = BoardLayout["mode"]
/** Explicit state semantics survive renaming and switching layout. Legacy states fall back to the section. */
export function isCardCompleted(
  card: Pick<Card, "columnId" | "stateId">,
  column?: Pick<Column, "done"> | null,
  layout?: BoardLayout
): boolean {
  const stateId = layout?.states.some((s) => s.id === card.stateId)
    ? card.stateId
    : (layout?.sections[card.columnId]?.stateId ?? layout?.states[0]?.id)
  return (
    layout?.states.find((s) => s.id === stateId)?.done ?? column?.done ?? false
  )
}
/** Original Column records are sections. Card identity/content and free placement never migrate. */
export function initialLayout(
  columns: Column[],
  mode: LayoutMode
): BoardLayout {
  const ordered = [...columns].sort((a, b) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : 0
  )
  const stages = ordered.length
    ? ordered.map((c) => ({ id: c.id, title: c.title, color: c.color }))
    : [{ id: "stage-default", title: t("Работа"), color: "" }]
  return {
    schemaVersion: 1,
    mode,
    tint: false,
    lanes: ordered.length
      ? ordered.map((c) => ({
          id: `lane-${c.id}`,
          title: c.title,
          color: c.color,
        }))
      : [{ id: "lane-default", title: t("Столбец"), color: "" }],
    stages,
    states: [{ id: "state-active", title: t("Активно"), color: "" }],
    sections: Object.fromEntries(
      ordered.map((c) => [
        c.id,
        {
          laneId: `lane-${c.id}`,
          stageId: c.id,
          stateId: "state-active",
          collapsed: false,
        },
      ])
    ),
  }
}
export function cardAxes(
  card: Pick<Card, "columnId" | "stageId" | "stateId">,
  layout: BoardLayout
): {
  stageId: string
  stateId: string
} {
  const section = layout.sections[card.columnId]
  return {
    stageId: layout.stages.some((s) => s.id === card.stageId)
      ? card.stageId!
      : (section?.stageId ?? layout.stages[0].id),
    stateId: layout.states.some((s) => s.id === card.stateId)
      ? card.stateId!
      : (section?.stateId ?? layout.states[0].id),
  }
}
export function validateLayout(layout: BoardLayout): BoardLayout {
  const parsed = BoardLayoutSchema.parse(layout)
  const unique = (
    xs: {
      id: string
    }[]
  ) => new Set(xs.map((x) => x.id)).size === xs.length
  if (![parsed.lanes, parsed.stages, parsed.states].every(unique))
    throw new Error(t("Повторяющийся идентификатор компоновки"))
  for (const section of Object.values(parsed.sections)) {
    if (section.position !== undefined) {
      try {
        if (!/^[A-Za-z][0-9A-Za-z]*$/.test(section.position))
          throw new Error("Invalid rank alphabet")
        generateKeyBetween(section.position, null)
      } catch {
        throw new Error(t("Недопустимая позиция секции"))
      }
    }
    if (
      !parsed.lanes.some((x) => x.id === section.laneId) ||
      !parsed.stages.some((x) => x.id === section.stageId) ||
      !parsed.states.some((x) => x.id === section.stateId)
    )
      throw new Error(t("Нарушены связи секции"))
  }
  return parsed
}
