import {
  fallbackCard,
  useCard,
  useCardCol,
  useUpdateCard,
  useDashboards,
} from "@bordena/core"
import { CardMeta } from "./card-meta"

interface IProps {
  cardId: string
  /** The unsaved body, for callers holding a draft. */
  body?: string
  className?: string
}

/**
 * `CardMeta` for a card the viewer can edit: reads it live, writes edits back.
 * An unset deadline or priority shows nothing — it is set from the card menu.
 */
export function CardMetaLive({ cardId, body, className }: IProps) {
  const { data: card = fallbackCard } = useCard(cardId)
  const { data: column } = useCardCol(cardId)
  const { data: dashboards } = useDashboards()
  const dashboard = dashboards?.find((d) => d.id === column?.dashboardId)
  const { mutate: updateCard } = useUpdateCard(cardId)

  return (
    <CardMeta
      card={card}
      layout={dashboard?.layout}
      column={column}
      body={body}
      onChangeDeadline={(deadline) => updateCard({ deadline })}
      onChangePriority={(priority) => updateCard({ priority })}
      className={className}
    />
  )
}
