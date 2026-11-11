import type { Dashboard } from "../../types"
import { db } from "../db/db"

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const dashboard = await db.getDashboard(id)
  return dashboard ?? null
}
