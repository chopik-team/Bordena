import {
  type Card,
  type Column,
  type Dashboard,
  flushCardEdits,
  sectionsInLane,
} from "@bordena/core"
import { t } from "@bordena/i18n"
import { webDb } from "./adapters/web-db"
import { applyOperations, type Operation } from "./exchange/changeset"

export function freeLaneOperations(
  board: Dashboard,
  columns: Column[],
  card: Card,
  laneId: string,
  sectionId: string = crypto.randomUUID()
): Operation[] {
  const layout = board.layout
  if (!layout || !layout.lanes.some((l) => l.id === laneId))
    throw new Error("Lane is unavailable")
  const target = sectionsInLane(
    layout,
    columns.filter((c) => !c.deletedAt),
    laneId
  )[0]
  const ops: Operation[] = target
    ? []
    : [
        {
          op: "create-section",
          id: sectionId,
          boardId: board.id,
          title: t("Задачи"),
        },
        {
          op: "configure-section",
          id: sectionId,
          boardId: board.id,
          expectedUpdatedAt: board.updatedAt,
          patch: { laneId },
        },
      ]
  ops.push({
    op: "move-card",
    id: card.id,
    expectedUpdatedAt: card.updatedAt,
    columnId: target?.id ?? sectionId,
  })
  return ops
}
export async function moveCardToEmptyLane(
  boardId: string,
  cardId: string,
  laneId: string
) {
  await flushCardEdits()
  const [board, card, columns] = await Promise.all([
    webDb.get<Dashboard>("dashboards", boardId),
    webDb.get<Card>("cards", cardId),
    webDb.getAll<Column>("columns"),
  ])
  if (
    !board ||
    board.deletedAt ||
    !card ||
    card.deletedAt ||
    !columns.some(
      (c) => c.id === card.columnId && c.dashboardId === boardId && !c.deletedAt
    )
  )
    throw new Error(t("Карточка недоступна"))
  await applyOperations(
    freeLaneOperations(
      board,
      columns.filter((c) => c.dashboardId === boardId),
      card,
      laneId
    )
  )
}
