import { byPosition } from "../../utils"
import { db } from "../db/db"
import { live } from "./live"
import { moveCardToColumn } from "./move-card-to-column"
import { createColumn } from "./create-column"
import { t } from "@bordena/i18n"

/**
 * Moves a card to the top of another board's first column. Returns the id of
 * the card now holding the content — see {@link moveCardToColumn}.
 */
export async function moveCardToBoard(
  id: string,
  boardId: string
): Promise<string> {
  const cols = await db.getColumns()
  const [first] = cols
    .filter((c) => c.dashboardId === boardId && live(c))
    .sort(byPosition)
  if (first) return moveCardToColumn(id, first.id)
  const board = await db.getDashboard(boardId),
    card = await db.getCard(id)
  if (!board || !live(board) || board.archived || !card || !live(card))
    throw new Error(t("Доска удалена или недоступна"))
  // A drop on an empty board creates its first section on demand.
  const columnId = await createColumn(boardId, t("Задачи"))
  return moveCardToColumn(id, columnId)
}
