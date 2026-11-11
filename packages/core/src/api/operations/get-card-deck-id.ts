import { getCardCol } from "./get-card-col"

/**
 * Walks a card back to its board through its column. The digest opens cards
 * from boards other than the one the app is pointed at, so the card panel has
 * to resolve its own deck rather than inherit the route's.
 */
export async function getCardDeckId(cardId: string): Promise<string | null> {
  const column = await getCardCol(cardId)
  return column?.dashboardId ?? null
}
