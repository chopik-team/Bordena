import type { Board } from "../types"
import { byPosition } from "./position"

/** Columns in board order, each with its cards in theirs. */
export function groupCardsByColumn(
  board: Board
): { column: Board["columns"][number]; cards: Board["cards"] }[] {
  const byColumn = new Map<string, Board["cards"]>(
    board.columns.map((c) => [c.id, []])
  )
  for (const card of [...board.cards].sort(byPosition)) {
    byColumn.get(card.columnId)?.push(card)
  }
  return [...board.columns]
    .sort(byPosition)
    .map((column) => ({ column, cards: byColumn.get(column.id) ?? [] }))
}
