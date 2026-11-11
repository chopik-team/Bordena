import { useT } from "@bordena/i18n"
import { MenuItem } from "@bordena/ui-kit"
import { Trash2 } from "lucide-react"
import { useParams } from "wouter"
import { useDeleteCard, useCard } from "@bordena/core"
import { useCardDeleteToast } from "@/components/toasts/card-delete/use-card-delete-toast"
import { routes } from "@/lib/routes"
export function DeleteItem({ cardId }: { cardId: string }) {
  const t = useT()
  const { id: deckId } = useParams<typeof routes.deck.pattern>()
  const { mutateAsync: deleteCard } = useDeleteCard(deckId)
  const { data: card } = useCard(cardId)
  const { showCardDeleteToast } = useCardDeleteToast()
  return (
    <MenuItem
      onClick={async () => {
        await deleteCard(cardId)
        showCardDeleteToast(cardId, {
          title: card?.title?.trim() || t("Карточка"),
        })
      }}
      variant="destructive"
    >
      <Trash2 />
      {t("Удалить")}{" "}
    </MenuItem>
  )
}
