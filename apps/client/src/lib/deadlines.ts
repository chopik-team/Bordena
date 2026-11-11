import type { Card, Column } from "@bordena/contract"
import { isCardCompleted, type BoardLayout } from "@bordena/core"
import { deadlineInstant } from "@bordena/core"
export { deadlineInstant } from "@bordena/core"
export function isCardOverdue(
  card: Pick<Card, "deadline" | "deletedAt"> &
    Partial<Pick<Card, "columnId" | "stateId">>,
  column?: Pick<Column, "done">,
  now = Date.now(),
  layout?: BoardLayout
): boolean {
  return (
    !card.deletedAt &&
    !isCardCompleted(
      { columnId: card.columnId ?? "", stateId: card.stateId },
      column,
      layout
    ) &&
    !!card.deadline &&
    deadlineInstant(card.deadline) < now
  )
}
export function deadlineRemaining(
  value: string,
  now = Date.now()
): number | null {
  const instant = deadlineInstant(value)
  return Number.isFinite(instant) ? instant - now : null
}
