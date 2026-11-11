import { useT } from "@bordena/i18n"
import { MenuItem, MenuSeparator } from "@bordena/ui-kit"
import { Hash } from "lucide-react"
import { useCard } from "@bordena/core"
import { cardDisplayId } from "@bordena/contract"
/** Copies the card's display id. Nothing to copy on a card that has never
 *  synced — its number is stamped there. */
export function CopyIdItem({ cardId }: { cardId: string }) {
  const t = useT()
  const { data: card } = useCard(cardId)
  const displayId = cardDisplayId(card?.number)
  if (!displayId) return null
  return (
    <>
      <MenuSeparator />
      <MenuItem onClick={() => void navigator.clipboard?.writeText(displayId)}>
        <Hash />
        {t("Скопировать ID")}{" "}
      </MenuItem>
    </>
  )
}
