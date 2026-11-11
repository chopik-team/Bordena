import { useLocation, useRoute } from "wouter"
import {
  boardDigest,
  groupBoardCards,
  type Board,
  type BoardLayout,
} from "@bordena/core"
import { routes } from "@/lib/routes"
import { DeckRows } from "./deck-rows"

interface IProps {
  board: Board
  title: string
  layout?: BoardLayout
}

/**
 * Groups the open board's cards for the row view
 */
export function DeckRowsView({ board, title, layout }: IProps) {
  const [, navigate] = useLocation()
  const [, params] = useRoute(routes.card.pattern)

  return (
    <DeckRows
      groups={groupBoardCards(boardDigest(board, title, layout))}
      openCardId={params?.id ?? null}
      onOpenCard={(entry) => navigate(routes.card.to(entry.card.id))}
    />
  )
}
