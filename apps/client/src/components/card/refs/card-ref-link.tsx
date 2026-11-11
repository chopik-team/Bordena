import { useT } from "@bordena/i18n"
import { useLocation, useRoute } from "wouter"
import { useCardRef } from "@bordena/core"
import { columnHue, MdWikilink } from "@bordena/ui-kit"
import { routes } from "@/lib/routes"
import { revealInMain } from "@/components/card-window/card-window-event"
import { useDeck } from "@/providers/deck/deck-context"
/**
 * A `[[12]]` reference rendered inside a card body: the card's id, then
 * its title, then a pill for the column it sits in, tinted with that
 * column's color.
 */
export function CardRefLink({
  displayId,
  alias,
}: {
  displayId: string
  alias?: string
}) {
  const t = useT()
  const [, navigate] = useLocation()
  const [inWindow] = useRoute(routes.cardWindow.pattern)
  const { id: deckId } = useDeck()
  const ref = useCardRef(deckId, displayId)
  if (!ref)
    return (
      <MdWikilink
        target={displayId}
        label={alias}
        unresolved
        title={t("Карточка не найдена")}
      />
    )
  const { card, columnTitle, columnColor, columnDone } = ref
  const title = alias || card.title || t("Без названия")
  return (
    <MdWikilink
      target={displayId}
      label={title}
      badge={columnTitle || undefined}
      hue={columnHue(columnColor)}
      done={columnDone}
      title={columnTitle ? `${title} — ${columnTitle}` : title}
      onOpen={() =>
        inWindow
          ? revealInMain({ cardId: card.id, deckId })
          : navigate(routes.card.to(card.id))
      }
    />
  )
}
