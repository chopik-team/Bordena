import { useT } from "@bordena/i18n"
import {
  Button,
  ContextMenu,
  ContextMenuTrigger,
  Menu,
  MenuTrigger,
  useIsMobile,
  type MenuActions,
} from "@bordena/ui-kit"
import { MoreHorizontal } from "lucide-react"
import { useRef, type ReactNode } from "react"
import { CardMenuItems } from "./menu-items"
interface IProps {
  cardId: string
  onEdit: () => void
  onShowHistory: () => void
}
export function CardMenu({ cardId, onEdit, onShowHistory }: IProps) {
  const t = useT()
  const actionsRef = useRef<MenuActions>(null)
  return (
    <Menu actionsRef={actionsRef}>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("Действия с карточкой")}
            onClick={(e) => e.stopPropagation()}
            tooltip={false}
          />
        }
      >
        <MoreHorizontal />
      </MenuTrigger>
      <CardMenuItems
        cardId={cardId}
        onEdit={onEdit}
        onShowHistory={onShowHistory}
        closeMenu={() => actionsRef.current?.close()}
      />
    </Menu>
  )
}
export function CardContextMenu({
  children,
  isEnabled = true,
  cardId,
  onEdit,
  onShowHistory,
}: IProps & {
  children: ReactNode
  isEnabled?: boolean
}) {
  const isMobile = useIsMobile()
  const actionsRef = useRef<MenuActions>(null)
  if (!isEnabled || isMobile) return children
  return (
    <ContextMenu actionsRef={actionsRef}>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <CardMenuItems
        align="start"
        cardId={cardId}
        onEdit={onEdit}
        onShowHistory={onShowHistory}
        closeMenu={() => actionsRef.current?.close()}
      />
    </ContextMenu>
  )
}
