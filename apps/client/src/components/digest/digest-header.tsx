import { useT } from "@bordena/i18n"
import { Button, cn } from "@bordena/ui-kit"
import type { Dashboard, DigestFilter } from "@bordena/core"
import { PageHeader } from "../app/page-header"
import { BoardFilter } from "./board-filter"
// const FILTERS: { id: DigestFilter; label: string }[] = [
//   // { id: "today", label: "Today" },
//   { id: "week", label: "Предстоящие" },
// ]
interface IProps {
  filter: DigestFilter
  onChangeFilter: (filter: DigestFilter) => void
  hideDone: boolean
  onToggleHideDone: () => void
  boards: Dashboard[]
  hiddenBoards: string[]
  onToggleBoard: (id: string) => void
}
export function DigestHeader({
  // filter,
  // onChangeFilter,
  hideDone,
  onToggleHideDone,
  boards,
  hiddenBoards,
  onToggleBoard,
}: IProps) {
  const t = useT()
  return (
    <PageHeader>
      <h1 className="text-base font-semibold">{t("Предстоящие")}</h1>
      <div className="ml-auto flex items-center gap-1">
        <BoardFilter
          boards={boards}
          hidden={hiddenBoards}
          onToggleBoard={onToggleBoard}
        />
        <Button
          size="sm"
          variant={hideDone ? "secondary" : "ghost"}
          aria-pressed={hideDone}
          className={cn(!hideDone && "text-muted-foreground")}
          onClick={onToggleHideDone}
        >
          {t("Скрыть готовые")}{" "}
        </Button>
        {/*{FILTERS.map(({ id, label }) => (
          <Button
            key={id}
            size="sm"
            variant={id === filter ? "secondary" : "ghost"}
            aria-pressed={id === filter}
            className={cn(id !== filter && "text-muted-foreground")}
            onClick={() => onChangeFilter(id)}
          >
            {label}
          </Button>
        ))}*/}
      </div>
    </PageHeader>
  )
}
