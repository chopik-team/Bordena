import { useBoard } from "@bordena/core"
import { useDeck } from "@/providers/deck/deck-context"
import { useLocation } from "wouter"
import { useT } from "@bordena/i18n"
import {
  Button,
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@bordena/ui-kit"
import {
  Plus,
  CalendarDays,
  PanelsTopLeft,
  CalendarPlus,
  FolderPlus,
} from "lucide-react"

/** Shared by the tab strip and sidebar creation button. */
export function CreateItemMenu({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  const t = useT(),
    [path, navigate] = useLocation()
  const { id } = useDeck()
  const { data: board } = useBoard(id)
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={className}
            aria-label={label}
            tooltip={t("Создать")}
          />
        }
      >
        <Plus />
      </MenuTrigger>
      <MenuContent align="start" className="w-56 max-w-[calc(100vw-24px)]">
        {path.startsWith("/d/") && !!board?.columns.length && (
          <MenuItem
            onClick={() => window.dispatchEvent(new Event("bordena:add-card"))}
          >
            <Plus />
            {t("Новая карточка")}
          </MenuItem>
        )}
        <MenuItem
          onClick={() =>
            window.dispatchEvent(new Event("bordena:create-board"))
          }
        >
          <PanelsTopLeft />
          {t("Новая доска")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (path.startsWith("/calendar"))
              window.dispatchEvent(new Event("bordena:create-event"))
            else navigate("~/calendar?new=event")
          }}
        >
          <CalendarPlus />
          {t("Новое событие")}
        </MenuItem>
        <MenuItem
          onClick={() =>
            window.dispatchEvent(new Event("bordena:create-workspace"))
          }
        >
          <FolderPlus />
          {t("Новое рабочее пространство")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (path.startsWith("/calendar"))
              window.dispatchEvent(new Event("bordena:create-calendar"))
            else navigate("~/calendar?new=calendar")
          }}
        >
          <CalendarDays />
          {t("Новый календарь")}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
