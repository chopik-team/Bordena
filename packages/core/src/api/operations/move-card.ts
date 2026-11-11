import type { Card } from "../../types"
import { db } from "../db/db"
import { recordHistory } from "../history/record-history"
import { sync } from "../sync"
import { stamp } from "../sync/hlc"
import { touchCard } from "../sync/touch"
import { cardAxes } from "../../board-layout"

/**
 * Persists cards whose column/position changed during a drag. Only the move is
 * applied: title/body are read back from the stored record so a concurrent edit
 * isn't clobbered by a stale copy from the board cache (the drag handler reads
 * cards from `keys.board`, which a rename doesn't invalidate).
 */
export async function moveCard(
  _deckId: string,
  changed: Card[]
): Promise<void> {
  const now = stamp()
  const layout = (await db.getDashboard(_deckId))?.layout
  await Promise.all(
    changed.map(async (card) => {
      let existing: Card | undefined
      await db.editCard(card.id, (current) => {
        existing = current
        const moved = {
          ...current,
          ...(layout ? cardAxes(current, layout) : {}),
          ...(layout?.mode === "matrix" ? cardAxes(card, layout) : {}),
          columnId: card.columnId,
          position: card.position,
        }
        return touchCard(moved, layout ? ["place", "axes"] : ["place"], now)
      })
      if (!existing) return
      if (existing.columnId !== card.columnId)
        await recordColumnChange(
          card.id,
          existing.title,
          existing.columnId,
          card.columnId
        )
    })
  )
  for (const card of changed) sync.markDirty("cards", card.id)
}

async function recordColumnChange(
  cardId: string,
  title: string,
  fromColumnId: string,
  toColumnId: string
): Promise<void> {
  const from = await db.getColumn(fromColumnId)
  const to = await db.getColumn(toColumnId)
  if (!from || !to) return
  await recordHistory.card(to.dashboardId, cardId, title, "move", {
    from: from.title,
    to: to.title,
  })
}
