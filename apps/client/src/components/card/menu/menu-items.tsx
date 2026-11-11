import { useCard, useUpdateCard } from "@bordena/core"
import { ColumnColorSubmenu } from "../../column/column-color"
import { useT } from "@bordena/i18n"
import { MenuContent, MenuItem, MenuSeparator } from "@bordena/ui-kit"
import { History, Pencil } from "lucide-react"
import { CopyIdItem } from "./copy-id-item"
import { DeadlineSub } from "./deadline-sub"
import { DeleteItem } from "./delete-item"
import { MoveToBoardSub } from "./move-to-board-sub"
import { MoveToColumnSub } from "./move-to-column-sub"
import { PrioritySub } from "./priority-sub"
import { TagsSub } from "./tags-sub"
interface IProps {
  cardId: string
  onEdit: () => void
  onShowHistory: () => void
  closeMenu: () => void
  align?: "start" | "center" | "end"
}
/** Everything the viewer can do to a card without opening it. */
export function CardMenuItems({
  cardId,
  onEdit,
  onShowHistory,
  closeMenu,
  align = "end",
}: IProps) {
  const t = useT()
  const { data: card } = useCard(cardId)
  const { mutate: update } = useUpdateCard(cardId)
  return (
    <MenuContent align={align} onClick={(e) => e.stopPropagation()}>
      <MenuItem onClick={onEdit}>
        <Pencil />
        {t("Редактировать")}{" "}
      </MenuItem>
      <MenuSeparator />
      <MoveToColumnSub cardId={cardId} />
      <MoveToBoardSub cardId={cardId} />
      <MenuSeparator />
      <ColumnColorSubmenu
        color={card?.color ?? ""}
        onChange={(color) => update({ color })}
      />
      <PrioritySub cardId={cardId} />
      <TagsSub cardId={cardId} />
      <DeadlineSub cardId={cardId} closeMenu={closeMenu} />
      <CopyIdItem cardId={cardId} />
      <MenuItem onClick={onShowHistory}>
        <History />
        {t("История")}{" "}
      </MenuItem>
      <MenuSeparator />
      <DeleteItem cardId={cardId} />
    </MenuContent>
  )
}
