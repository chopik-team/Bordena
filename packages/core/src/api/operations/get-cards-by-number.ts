import type { Card } from "../../types"
import { db } from "../db/db"

/** Cards carrying this number, across every board — the index is global. */
export async function getCardsByNumber(num: number): Promise<Card[]> {
  return (await db.getCardsByNumber(num)) ?? []
}
