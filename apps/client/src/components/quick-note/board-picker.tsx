import { useT } from "@bordena/i18n"
import type { Dashboard } from "@bordena/core"
import { MenuItem } from "@bordena/ui-kit"
import { Picker } from "./picker"

interface IProps {
  dashboards: Dashboard[]
  board: Dashboard | undefined
  onPick: (id: string) => void
}

export function BoardPicker({ dashboards, board, onPick }: IProps) {
  const t = useT()

  return (
    <Picker label={board ? board.title : t("No boards")}>
      {dashboards.map((d) => (
        <MenuItem key={d.id} onClick={() => onPick(d.id)}>
          {d.title}
        </MenuItem>
      ))}
    </Picker>
  )
}
