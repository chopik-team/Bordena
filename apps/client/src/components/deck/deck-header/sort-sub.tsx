import { useT } from "@bordena/i18n"
import { MenuContent, MenuItem, MenuSub, MenuSubTrigger } from "@bordena/ui-kit"
import { SORT_MODES, type SortKey } from "@bordena/core"
import {
  CalendarClock,
  Check,
  Flag,
  ListFilter,
  CircleGauge,
} from "lucide-react"
const ICONS: Record<SortKey, typeof Flag> = {
  priority: Flag,
  deadline: CalendarClock,
  progress: CircleGauge,
}
interface IProps {
  sort: string[]
  onChangeSort: (sort: string[]) => void
}
/** The board's card ordering: any mix of the keys, or none for manual order. */
export function SortSub({ sort, onChangeSort }: IProps) {
  const t = useT()
  function toggleSort(key: string) {
    if (sort.includes(key)) onChangeSort(sort.filter((k) => k !== key))
    else onChangeSort([...sort, key])
  }
  return (
    <MenuSub>
      <MenuSubTrigger>
        <ListFilter />
        {t("Сортировка карточек")}{" "}
      </MenuSubTrigger>
      <MenuContent align="start" sideOffset={2}>
        {SORT_MODES.map(({ id }) => {
          const Icon = ICONS[id]
          return (
            <MenuItem
              key={id}
              closeOnClick={false}
              onClick={() => toggleSort(id)}
            >
              <Icon />
              {t("По")}{" "}
              {id === "priority"
                ? t("приоритету")
                : id === "progress"
                  ? t("готовности")
                  : t("сроку")}
              {sort.includes(id) && <Check className="ml-auto" />}
            </MenuItem>
          )
        })}
      </MenuContent>
    </MenuSub>
  )
}
