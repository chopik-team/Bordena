import type { Column } from "../../types"
import { db } from "../db/db"

/** The column a card lives in. */
export async function getCardCol(cardId: string): Promise<Column | null> {
  const card = await db.getCard(cardId)
  if (!card) return null
  const column = await db.getColumn(card.columnId)
  return column ?? null
}
