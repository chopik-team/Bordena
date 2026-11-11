import { db } from "../db/db"
import { live } from "./live"

/** What a board has tombstoned. A file naming anything else is new to it. */
export interface DeletedIds {
  columns: string[]
  cards: string[]
}

/**
 * Ids the board deleted, live ones excluded. The vault needs the difference
 * between a record this board threw away and one it has simply never seen.
 */
export async function getDeletedIds(deckId: string): Promise<DeletedIds> {
  const mine = (await db.getColumns()).filter((c) => c.dashboardId === deckId)
  const cards = (await Promise.all(mine.map((c) => db.getCards(c.id)))).flat()
  return {
    columns: mine.filter((c) => !live(c)).map((c) => c.id),
    cards: cards.filter((c) => !live(c)).map((c) => c.id),
  }
}
