import { TaskIndicator, cn } from "@bordena/ui-kit"
import { taskProgress, type TaskProgress } from "@bordena/markdown"
import type { ReactNode } from "react"
import {
  isCardCompleted,
  type BoardLayout,
  type Card,
  type Column,
} from "@bordena/core"
import { ConflictMarker } from "./conflict-marker"
import { CardDeadline } from "./deadline/card-deadline"
import { CardPriority } from "./priority/card-priority"

interface IProps {
  card: Card
  layout?: BoardLayout
  /** The column the card sits in — a card in the done column reads as finished. */
  column?: Column | null
  /** The unsaved body, for callers holding a draft — task progress tracks it live. */
  body?: string
  /** Already-counted progress, for a caller that needed the count itself. */
  tasks?: TaskProgress
  /** Omit to show the deadline without a picker. */
  onChangeDeadline?: (deadline: string | null) => void
  /** Omit to show the priority without a picker. */
  onChangePriority?: (priority: string) => void
  className?: string
  showEmpty?: boolean
  lead?: ReactNode
}

/** A card's task progress, deadline and priority — on the board card and in its panel. */
export function CardMeta({
  card,
  column,
  layout,
  body,
  tasks,
  onChangeDeadline,
  onChangePriority,
  className,
  showEmpty,
  lead,
}: IProps) {
  const { done, total } = tasks ?? taskProgress(body ?? card.body)

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm",
        className
      )}
    >
      {lead}
      {total > 0 && <TaskIndicator done={done} total={total} />}
      {(showEmpty || !!card.deadline) && (
        <CardDeadline
          done={isCardCompleted(card, column, layout)}
          value={card.deadline}
          onChange={onChangeDeadline}
        />
      )}
      {(showEmpty || !!card.priority) && (
        <CardPriority value={card.priority} onChange={onChangePriority} />
      )}
      {card.bodyConflict && <ConflictMarker />}
    </div>
  )
}
