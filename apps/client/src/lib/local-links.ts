import { navigate } from "wouter/use-browser-location"
import { webDb } from "./adapters/web-db"
import type { Card, Dashboard, Column } from "@bordena/contract"
export function parseLocalLink(
  value: string
): { kind: "board" | "card"; id: string } | null {
  const match = /^bordena:\/\/(board|card)\/([a-zA-Z0-9_-]{1,128})$/.exec(value)
  return match ? { kind: match[1] as "board" | "card", id: match[2] } : null
}
export async function openLocalLink(value: string): Promise<void> {
  const target = parseLocalLink(value)
  if (!target) throw new Error("Invalid Bordena link")
  const entity = await webDb.get<Card | Dashboard>(
    target.kind === "board" ? "dashboards" : "cards",
    target.id
  )
  if (!entity || entity.deletedAt)
    throw new Error("Linked object is unavailable")
  if (target.kind === "board") navigate(`/d/${target.id}`)
  else {
    const column = await webDb.get<Column>("columns", (entity as Card).columnId)
    const board = column
      ? await webDb.get<Dashboard>("dashboards", column.dashboardId)
      : undefined
    if (!column || column.deletedAt || !board || board.deletedAt)
      throw new Error("Linked object is unavailable")
    navigate(`/d/${board.id}/c/${target.id}`)
  }
}
