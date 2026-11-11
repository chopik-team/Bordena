import { useT } from "@bordena/i18n"
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  cn,
} from "@bordena/ui-kit"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
interface IProps {
  onRename: () => void
  onDelete: () => void
  onMove?: () => void
  onArchive?: () => void
  archived?: boolean
  onProperties?: () => void
}
export function FolderMenu({
  onRename,
  onDelete,
  onMove,
  onArchive,
  archived,
  onProperties,
}: IProps) {
  const t = useT()
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("Действия с папкой")}
            tooltip={false}
            className={cn(
              "absolute top-1.5 right-px text-muted-foreground opacity-0 max-md:opacity-100",
              "group-hover/menu-item:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
            )}
          />
        }
      >
        <MoreVertical />
      </MenuTrigger>
      <MenuContent>
        {onProperties && (
          <MenuItem onClick={onProperties}>{t("Параметры проекта")}</MenuItem>
        )}
        {onMove && (
          <MenuItem onClick={onMove}>{t("Переместить проект")}</MenuItem>
        )}
        {onArchive && (
          <MenuItem onClick={onArchive}>
            {archived ? t("Вернуть из архива") : t("Архивировать проект")}
          </MenuItem>
        )}
        <MenuItem onClick={onRename}>
          <Pencil />
          {t("Переименовать")}{" "}
        </MenuItem>
        <MenuItem onClick={onDelete} variant="destructive">
          <Trash2 />
          {t("Удалить папку")}{" "}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
