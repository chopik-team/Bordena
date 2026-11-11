import { useT } from "@bordena/i18n"
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  cn,
} from "@bordena/ui-kit"
import { Check } from "lucide-react"
import type { Dashboard } from "@bordena/core"
interface IProps {
  boards: Dashboard[]
  hidden: string[]
  onToggleBoard: (id: string) => void
}
export function BoardFilter({ boards, hidden, onToggleBoard }: IProps) {
  const t = useT()
  const isFiltered = boards.some((b) => hidden.includes(b.id))
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant={isFiltered ? "secondary" : "ghost"}
            className={cn(!isFiltered && "text-muted-foreground")}
          />
        }
      >
        {t("Доски")}{" "}
      </MenuTrigger>
      <MenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
        {boards.map((board) => (
          <MenuItem
            key={board.id}
            closeOnClick={false}
            onClick={() => onToggleBoard(board.id)}
          >
            <span className="truncate">{board.title || t("Новая доска")}</span>
            {!hidden.includes(board.id) && <Check className="ml-auto" />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
