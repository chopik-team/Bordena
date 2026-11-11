import type { Column } from "../../types"
import { db } from "../db/db"

export async function getColumn(id: string): Promise<Column | null> {
  return (await db.getColumn(id)) ?? null
}
