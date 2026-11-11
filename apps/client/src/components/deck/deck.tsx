import { useT } from "@bordena/i18n"
import { useState } from "react"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"
import {
  type Board,
  type Dashboard,
  type DashboardView,
  byPosition,
  filterByTags,
  filterByUsers,
  groupCardsByColumn,
  sortCards,
  type CardPatch,
  type Card,
  type Column as ColumnData,
  type ProgressReader,
  moveSection,
  cardAxes,
} from "@bordena/core"
import { useLandingSlot } from "@/lib/hooks"
import { useDeck } from "@/providers/deck/deck-context"
import { Column } from "../column/column"
import { AddColumn } from "../column/add-column"
import { DraggableCard } from "../card/draggable-card"
import { BoardView } from "./board-view"
import { DragStateProvider } from "./drag-state"
import { BoardActionsMenu } from "./deck-header/board-actions-menu"
import { DeckHeader } from "./deck-header/deck-header"
import { TagFilterPills } from "./deck-header/tag-filter-pills"
import { DeckRowsView } from "./deck-rows-view"
import { useSidebarCardDrop } from "./use-sidebar-card-drop"
import { FreeBoard, MatrixBoard, type SectionControls } from "./layout-board"
import { useLayoutChange } from "@/lib/hooks/use-layout-change"
import { useSectionAutoScroll } from "@/lib/hooks/use-section-autoscroll"
import { matrixDrop } from "@/lib/matrix-drop"
import { useMatrixTarget } from "@/lib/hooks/use-matrix-target"
import { MirrorList } from "../card/mirror-list"
import { applyOperations } from "@/lib/exchange/changeset"
import { reportError } from "@bordena/core"
import { generateKeyBetween } from "fractional-indexing"
import { Button } from "@bordena/ui-kit"
import { Plus } from "lucide-react"
import { GoalPathView } from "./goal-path-view"
import { BoardTable } from "./board-table"
import { moveCardToEmptyLane } from "@/lib/free-lane-drop"
interface IProps {
  dashboard: Dashboard
  board: Board
  isLoading: boolean
  onToggleBody: (columnId: string, collapsed: boolean) => void
  onAddCard: (columnId: string) => void
  /** Creates a card and opens it, for the header's add. */
  onAddAndOpenCard: (columnId: string) => void
  onAddColumn: () => void
  onReorderColumns: (changed: Board["columns"]) => void
  onChangeColumnColor: (columnId: string, color: string) => void
  onChangeColumnDone: (columnId: string, done: boolean) => void
  onRenameColumn: (columnId: string, title: string) => void
  onDeleteColumn: (columnId: string) => void
  onRenameDashboard: (name: string) => void
  onDeleteDashboard: () => void
  onChangeSort: (sort: string[]) => void
  view: DashboardView
  onChangeView: (view: DashboardView) => void
  onDragEnd: (result: DropResult) => void
  onMoveCardToBoard: (move: { id: string; boardId: string }) => void
  onPatchCard: (id: string, patch: CardPatch) => void
  onMatrixMove: (changed: Card[]) => void
  onMatrixAdd: (stageId: string, stateId: string) => void
  progressOf: ProgressReader
}
export function Deck({
  dashboard,
  board,
  isLoading,
  onToggleBody,
  onAddCard,
  onAddAndOpenCard,
  onAddColumn,
  onReorderColumns,
  onChangeColumnColor,
  onChangeColumnDone,
  onRenameColumn,
  onDeleteColumn,
  onRenameDashboard,
  onDeleteDashboard,
  onChangeSort,
  view,
  onChangeView,
  onDragEnd,
  onMoveCardToBoard,
  onPatchCard,
  onMatrixMove,
  onMatrixAdd,
  progressOf,
}: IProps) {
  const t = useT()
  const [isDragging, setIsDragging] = useState(false)
  const [sectionDragging, setSectionDragging] = useState(false)
  useSectionAutoScroll(sectionDragging)
  const { mutate: changeLayout, isPending: layoutBusy } = useLayoutChange(dashboard.id)
  const sidebarDrop = useSidebarCardDrop(isDragging)
  const matrixTarget = useMatrixTarget(
    dashboard.layout?.mode === "matrix" && view === "board",
    isDragging
  )
  const { tagFilters = [], userFilters = [] } = useDeck()
  const isFiltered = tagFilters.length > 0 || userFilters.length > 0
  const filteredReason = isFiltered
    ? t("Снимите фильтры, чтобы добавить карточку")
    : undefined
  const visible = {
    ...board,
    cards: filterByUsers(filterByTags(board.cards, tagFilters), userFilters),
  }
  const grouped = groupCardsByColumn(visible)
  const orderedColumns = [...board.columns].sort(byPosition)
  const sort = dashboard.sort ?? []
  const { hold, release, place } = useLandingSlot(sort.length > 0)
  const renderSection = (
    column: ColumnData,
    sectionCollapsed = false,
    controls?: SectionControls
  ) => {
    const cards = grouped.find((g) => g.column.id === column.id)?.cards ?? []
    const ordered = place(sortCards(cards, sort, progressOf), column.id)
    const showBody = !column.collapsed
    return (
      <Column
        key={column.id}
        id={column.id}
        title={column.title}
        color={column.color}
        showBody={showBody}
        sectionCollapsed={sectionCollapsed}
        leading={controls?.leading}
        headerDragProps={controls?.headerDragProps}
        menuExtra={controls?.menu}
        onToggleSection={controls?.onCollapse}
        autoRename={controls?.autoRename}
        tint={dashboard.layout?.tint}
        onToggleBody={() => onToggleBody(column.id, showBody)}
        onAddCard={() => onAddCard(column.id)}
        addCardDisabledReason={filteredReason}
        onRename={(title) => onRenameColumn(column.id, title)}
        onChangeColor={(color) => onChangeColumnColor(column.id, color)}
        done={column.done}
        onChangeDone={(done) => onChangeColumnDone(column.id, done)}
        onDelete={() => onDeleteColumn(column.id)}
      >
        {ordered.map((card, index) => (
          <DraggableCard
            key={card.id}
            card={card}
            layout={dashboard.layout}
            presentationProgress={progressOf(card) ?? null}
            column={column}
            index={index}
            showBody={showBody}
            compact={sidebarDrop.overSidebar}
            vanishOnDrop={sidebarDrop.landing}
            onPatch={onPatchCard}
            onDropSettled={release}
          />
        ))}
        <MirrorList dashboard={dashboard} column={column} />
      </Column>
    )
  }
  return (
    <DragStateProvider value={isDragging}>
      <DragDropContext
        dragHandleUsageInstructions={t(
          "Space — начать перенос, стрелки — выбрать позицию, Space — подтвердить, Esc — отменить."
        )}
        onDragUpdate={(update, provided) =>
          provided.announce(
            t("Позиция переноса: {position}", {
              position: update.destination ? update.destination.index + 1 : "—",
            })
          )
        }
        onDragStart={(start, provided) => {
          provided.announce(t("Перенос начат."))
          setIsDragging(true)
          setSectionDragging(start.type === "SECTION")
        }}
        onDragEnd={(result, provided) => {
          provided.announce(
            t(
              result.reason === "CANCEL"
                ? "Перенос отменён."
                : "Перенос завершён."
            )
          )
          setIsDragging(false)
          setSectionDragging(false)
          if (result.type === "MIRROR") {
            if (result.reason === "DROP" && result.destination) {
              const destination = result.destination.droppableId
              const matrix = destination.startsWith("mirror-matrix|")
                ? destination.split("|")
                : undefined
              const columnId = destination.slice("mirrors:".length),
                mirrorId = result.draggableId.slice("mirror:".length)
              const ordered = (dashboard.mirrors ?? [])
                .filter((m) => {
                  if (m.id === mirrorId) return false
                  if (!matrix || !dashboard.layout)
                    return m.columnId === columnId
                  const axes = cardAxes(m, dashboard.layout)
                  return (
                    axes.stageId === matrix[1] && axes.stateId === matrix[2]
                  )
                })
                .sort(byPosition)
              const index = result.destination.index
              void applyOperations([
                {
                  op: "move-mirror",
                  boardId: dashboard.id,
                  id: mirrorId,
                  expectedUpdatedAt: dashboard.updatedAt,
                  patch: {
                    ...(matrix
                      ? { stageId: matrix[1], stateId: matrix[2] }
                      : { columnId }),
                    position: generateKeyBetween(
                      ordered[index - 1]?.position ?? null,
                      ordered[index]?.position ?? null
                    ),
                  },
                },
              ]).catch(reportError)
            }
            return
          }
          if (result.type === "SECTION") {
            sidebarDrop.takeDrop()
            if (result.reason === "DROP" && result.destination) {
              const { droppableId, index } = result.destination
              changeLayout((l) =>
                moveSection(
                  l,
                  board.columns,
                  result.draggableId.slice("section:".length),
                  droppableId.slice("lane:".length),
                  index
                )
              )
            }
            return
          }
          const boardId = sidebarDrop.takeDrop()
          if (boardId) {
            onMoveCardToBoard({ id: result.draggableId, boardId })
            return
          }
          if (
            result.destination?.droppableId.startsWith("free-lane|") &&
            result.reason === "DROP"
          ) {
            void moveCardToEmptyLane(
              dashboard.id,
              result.draggableId,
              result.destination.droppableId.slice("free-lane|".length)
            ).catch(reportError)
            return
          }
          if (dashboard.layout?.mode === "matrix" && view !== "rows") {
            onMatrixMove(
              matrixDrop(
                visible,
                dashboard.layout,
                sort,
                matrixTarget(result),
                progressOf
              )
            )
            return
          }
          hold(result)
          onDragEnd(result)
        }}
      >
        <BoardActionsMenu
          boardId={dashboard.id}
          title={dashboard.title}
          columns={orderedColumns}
          sort={sort}
          onChangeSort={onChangeSort}
          onDelete={onDeleteDashboard}
          onReorderColumns={onReorderColumns}
          onDateList={() => onChangeView("rows")}
        >
          <BoardView
            twoAxis={dashboard.layout?.mode === "matrix" && view !== "rows"}
            scrollKey={`${dashboard.layout?.mode ?? "legacy"}:${view}`}
            isLoading={isLoading}
            isDragging={isDragging}
            header={
              <>
                <DeckHeader
                  boardId={dashboard.id}
                  title={dashboard.title}
                  onRename={onRenameDashboard}
                  onDelete={onDeleteDashboard}
                  columns={orderedColumns}
                  onReorderColumns={onReorderColumns}
                  sort={sort}
                  onChangeSort={onChangeSort}
                  view={view}
                  onChangeView={onChangeView}
                  onAddCard={() => {
                    if (orderedColumns[0])
                      onAddAndOpenCard(orderedColumns[0].id)
                  }}
                  addCardDisabledReason={
                    orderedColumns.length === 0
                      ? t("Сначала добавьте секцию")
                      : filteredReason
                  }
                />
                <TagFilterPills />
                {view === "board" && dashboard.layout?.mode === "free" && (
                  <div className="shrink-0 px-5 pb-2">
                    <Button size="sm" variant="ghost" disabled={layoutBusy || dashboard.layout.lanes.length >= 1000}
                      onClick={() => changeLayout((l) => ({ ...l, lanes: [...l.lanes, {id: crypto.randomUUID(), title: t("Новый столбец"), color: ""}] }))}>
                      <Plus aria-hidden="true" />{t("Добавить столбец")}
                    </Button>
                  </div>
                )}
              </>
            }
          >
            {view === "goal" ? (
              <GoalPathView
                dashboard={dashboard}
                board={visible}
                onPatch={onPatchCard}
                onAdd={onMatrixAdd}
                addDisabledReason={filteredReason}
                progressOf={progressOf}
              />
            ) : view === "table" ? (
              <BoardTable
                dashboard={dashboard}
                board={visible}
                onPatch={onPatchCard}
                progressOf={progressOf}
              />
            ) : view === "rows" ? (
              <DeckRowsView
                board={visible}
                title={dashboard.title}
                layout={dashboard.layout}
              />
            ) : dashboard.layout?.mode === "matrix" ? (
              <MatrixBoard
                dashboard={dashboard}
                board={visible}
                onPatch={onPatchCard}
                onAdd={onMatrixAdd}
                release={release}
                progressOf={progressOf}
                addDisabledReason={filteredReason}
              />
            ) : dashboard.layout?.mode === "free" ? (
              <FreeBoard
                dashboard={dashboard}
                board={visible}
                renderSection={renderSection}
              />
            ) : (
              <>
                {grouped.map(({ column }) => renderSection(column))}
                <AddColumn onAdd={onAddColumn} />
              </>
            )}
            {view !== "board" && !!dashboard.mirrors?.length && (
              <aside className="w-sm shrink-0 px-3">
                {board.columns.map((column) => (
                  <MirrorList
                    key={column.id}
                    dashboard={dashboard}
                    column={column}
                  />
                ))}
              </aside>
            )}
          </BoardView>
        </BoardActionsMenu>
      </DragDropContext>
    </DragStateProvider>
  )
}
