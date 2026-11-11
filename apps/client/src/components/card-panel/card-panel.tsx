import { useT } from "@bordena/i18n"
import { useIsMobile } from "@bordena/ui-kit"
import { useCallback, useEffect, useState } from "react"
import { useLocation, useRoute } from "wouter"
import { routes } from "@/lib/routes"
import { useDeck } from "@/providers/deck/deck-context"
import { useRevealCard } from "@/providers/card-reveal/card-reveal-context"
import { useCardDeleteToast } from "@/components/toasts/card-delete/use-card-delete-toast"
import { CardPane } from "./card-pane"
import { CardPanelShell } from "./card-panel-shell"
import { useCardSave, useDeleteCard, useCard, reportError } from "@bordena/core"
import { isDesktop } from "@/lib/platform"
import {
  openCardWindow,
  type DropPoint,
} from "@/components/card-window/open-card-window"
interface IProps {
  /** Where to navigate when the panel closes (its deck root). */
  closeHref: string
}
export function CardPanel({ closeHref }: IProps) {
  const t = useT()
  const [, navigate] = useLocation()
  const [, routeParams] = useRoute(routes.card.pattern)
  const routeId = routeParams?.id ?? null
  // Outlives the route change, so the card stays on screen while the panel sweeps shut.
  const [lastCard, setLastCard] = useState(routeId)
  if (routeId && routeId !== lastCard) setLastCard(routeId)
  const { queue, flush } = useCardSave()
  const { id: deckId } = useDeck()
  const { mutate: deleteCard } = useDeleteCard(deckId)
  const reveal = useRevealCard()
  const { showCardDeleteToast } = useCardDeleteToast()
  const isMobile = useIsMobile()
  const card = routeId ?? (isMobile ? null : lastCard)
  const isOpen = routeId != null
  const { data: content } = useCard(card)
  const close = useCallback(() => {
    flush()
    navigate(closeHref)
  }, [flush, navigate, closeHref])
  useEffect(() => {
    if (isOpen && content?.deletedAt) close()
  }, [isOpen, content?.deletedAt, close])
  const popOut = isDesktop()
    ? (at?: DropPoint) => {
        if (!card) return
        void openCardWindow(card, at).then(close).catch(reportError)
      }
    : undefined
  return (
    <CardPanelShell
      isOpen={isOpen}
      onClose={close}
      onClosed={() => setLastCard(null)}
      onTearOff={popOut}
    >
      {card && content && (
        <CardPane
          key={card}
          cardId={card}
          content={content}
          onQueue={queue}
          onFlush={flush}
          onClose={close}
          onDelete={() => {
            deleteCard(card, {
              onSuccess: () =>
                showCardDeleteToast(card, {
                  reopenPanel: true,
                  title: content.title.trim() || t("Без названия"),
                }),
            })
          }}
          onReveal={() => {
            if (isMobile) close()
            reveal(card)
          }}
          onPopOut={popOut && (() => popOut())}
        />
      )}
    </CardPanelShell>
  )
}
