import { useT } from "@bordena/i18n"
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  ContextMenu,
  ContextMenuTrigger,
} from "@bordena/ui-kit"
import { CircleCheck, MoreHorizontal, Trash2 } from "lucide-react"
import { ColumnColorSubmenu } from "./column-color"
import type { ReactNode } from "react"
interface IProps {
  title: string
  color: string
  onChangeColor: (color: string) => void
  done: boolean
  onChangeDone: (done: boolean) => void
  onDelete: () => void
  children?: ReactNode
  extra?: ReactNode
  showBody?: boolean
  onToggleBody?: () => void
}
/** The column's rarely-reached actions, behind a ⋯ in its header. */
export function ColumnMenu({
  title,
  children,
  color,
  onChangeColor,
  done,
  onChangeDone,
  onDelete,
  extra,
  showBody,
  onToggleBody,
}: IProps) {
  const t = useT()
  const items = (
    <>
      {extra}
      {onToggleBody && (
        <MenuItem onClick={onToggleBody}>
          {showBody ? t("Скрыть заметки") : t("Показать заметки")}
        </MenuItem>
      )}
      <ColumnColorSubmenu color={color} onChange={onChangeColor} />
      <MenuItem onClick={() => onChangeDone(!done)}>
        <CircleCheck />
        {done
          ? t("Не отмечать карточки выполненными")
          : t("Отмечать карточки выполненными")}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={onDelete} variant="destructive">
        <Trash2 />
        {t("Удалить колонку")}{" "}
      </MenuItem>
    </>
  )
  if (children)
    return (
      <ContextMenu>
        <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
        <MenuContent align="start">{items}</MenuContent>
      </ContextMenu>
    )
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t("Действия с секцией: {p0}", { p0: title })}
          />
        }
      >
        <MoreHorizontal />
      </MenuTrigger>
      <MenuContent>{items}</MenuContent>
    </Menu>
  )
}
