import { useT } from "@bordena/i18n"
import { Button, InvisibleInput } from "@bordena/ui-kit"
import { Plus } from "lucide-react"
import { useEffect } from "react"
import { PageHeader } from "../../app/page-header"
import { BoardActionsMenu } from "./board-actions-menu"
import { SearchButton } from "./search-button"
import { RowViewButton } from "./row-view-button"
import type { Column, DashboardView } from "@bordena/core"
interface IProps {
  boardId: string
  title: string
  columns: Column[]
  sort: string[]
  view: DashboardView
  onRename: (name: string) => void
  onDelete: () => void
  onReorderColumns: (changed: Column[]) => void
  onChangeSort: (sort: string[]) => void
  onChangeView: (view: DashboardView) => void
  onAddCard: () => void
  addCardDisabledReason?: string
}
export function DeckHeader({
  boardId,
  title,
  columns,
  sort,
  view,
  onRename,
  onDelete,
  onReorderColumns,
  onChangeSort,
  onChangeView,
  onAddCard,
  addCardDisabledReason,
}: IProps) {
  const t = useT()
  useEffect(() => {
    const add = () => {
      if (!addCardDisabledReason) onAddCard()
    }
    window.addEventListener("bordena:add-card", add)
    return () => window.removeEventListener("bordena:add-card", add)
  }, [onAddCard, addCardDisabledReason])
  return (
    <PageHeader className="bordena-board-header flex-wrap gap-3 py-4">
      <InvisibleInput
        value={title}
        onCommit={onRename}
        label={t("Название доски")}
        title={title}
        className="bordena-board-title min-w-0 text-left text-xl font-semibold"
      />

      <RowViewButton
        boardId={boardId}
        view={view}
        onChangeView={onChangeView}
      />
      <div className="bordena-board-actions flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          aria-label={t("Добавить карточку")}
          onClick={onAddCard}
          disabled={!!addCardDisabledReason}
          tooltip={addCardDisabledReason ?? true}
        >
          <Plus /> {t("Создать")}
        </Button>
        <SearchButton boardId={boardId} />
        <BoardActionsMenu
          boardId={boardId}
          title={title}
          columns={columns}
          sort={sort}
          onChangeSort={onChangeSort}
          onDateList={() => onChangeView("rows")}
          onDelete={onDelete}
          onReorderColumns={onReorderColumns}
        />
      </div>
    </PageHeader>
  )
}
