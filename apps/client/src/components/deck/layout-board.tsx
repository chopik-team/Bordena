import { useUiFlag } from "@/lib/ui-state"
import { useT } from "@bordena/i18n"
import { useState, type ReactNode } from "react"
import { useMutation } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import {
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd"
import { SectionCommands, SectionOptions } from "../column/section-options"
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuContent,
  MenuItem,
  Button,
  InvisibleInput,
  Menu,
  MenuTrigger,
} from "@bordena/ui-kit"
import { columnHue } from "@bordena/tokens"
import {
  byPosition,
  cardAxes,
  createColumn,
  moveSection,
  sectionPlacement,
  sectionsInLane,
  keys,
  queryClient,
  sortCards,
  type Board,
  type Card,
  type CardPatch,
  type Column as ColumnData,
  type Dashboard,
  type ProgressReader,
} from "@bordena/core"
import { changeLayout } from "@/lib/layout-workspace"
import { DraggableCard } from "../card/draggable-card"
import { MirrorList } from "../card/mirror-list"
import { useLayoutChange } from "@/lib/hooks/use-layout-change"
export interface SectionControls {
  leading: ReactNode
  headerDragProps?: DraggableProvidedDragHandleProps | null
  menu: ReactNode
  onCollapse: () => void
  autoRename?: boolean
}
export function FreeBoard({
  dashboard,
  board,
  renderSection,
}: {
  dashboard: Dashboard
  board: Board
  renderSection: (
    column: ColumnData,
    collapsed: boolean,
    controls: SectionControls
  ) => ReactNode
}) {
  const t = useT()
  const [fillWidth] = useUiFlag("board-fill:" + dashboard.id, true)
  const layout = dashboard.layout!
  const { mutate: change } = useLayoutChange(dashboard.id)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [autoRenameId, setAutoRenameId] = useState<string | null>(null)
  const [renameLane, setRenameLane] = useState<string | null>(null)
  const add = useMutation({
    mutationFn: async (laneId: string) => {
      const sectionId = await createColumn(dashboard.id, t("Новая секция"))
      await changeLayout(dashboard.id, (l) => ({
        ...l,
        sections: {
          ...l.sections,
          [sectionId]: {
            laneId,
            stageId: l.stages[0].id,
            stateId: l.states[0].id,
            progressMode: "off",
          },
        },
      }))
      return sectionId
    },
    onSuccess: (id) => setAutoRenameId(id),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: keys.board(dashboard.id),
      })
      await queryClient.invalidateQueries({ queryKey: keys.dashboards })
    },
  })
  const selected = board.columns.find((c) => c.id === settingsId)
  const selectedPlacement = selected ? sectionPlacement(layout, selected) : null
  const move = (id: string, laneId: string, index: number) =>
    change((l) => moveSection(l, board.columns, id, laneId, index))
  return (
    <>
      {layout.lanes.map((lane, laneIndex) => {
        const sections = sectionsInLane(layout, board.columns, lane.id)
        return (
          <div
            key={lane.id}
            data-layout-lane={lane.id}
            data-fill-width={fillWidth}
            className="bordena-lane w-sm shrink-0 snap-center overflow-y-auto pb-6"
            style={{
              flex: fillWidth ? "1 0 320px" : "0 0 384px",
              minWidth: fillWidth ? 320 : 384,
            }}
          >
            <ContextMenu>
              <ContextMenuTrigger>
                <div
                  className="bordena-lane-heading mb-2 flex items-center justify-between rounded-md px-2 py-2 text-sm font-semibold"
                  style={
                    lane.color && columnHue(lane.color) != null
                      ? {
                          backgroundColor: `oklch(0.7 0.13 ${columnHue(lane.color)} / 0.13)`,
                        }
                      : undefined
                  }
                >
                  <InvisibleInput
                    key={lane.id + String(renameLane === lane.id)}
                    value={
                      lane.title || t("Столбец {p0}", { p0: laneIndex + 1 })
                    }
                    label={t("Название столбца")}
                    title={lane.title}
                    className="min-w-0 flex-1 text-left"
                    activation="doubleClick"
                    emptyMessage={t("Введите название столбца")}
                    autoEdit={renameLane === lane.id}
                    onEditingEnd={() => setRenameLane(null)}
                    onCommit={(title) => {
                      change((l) => ({
                        ...l,
                        lanes: l.lanes.map((v) =>
                          v.id === lane.id ? { ...v, title } : v
                        ),
                      }))
                      setRenameLane(null)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("Добавить секцию")}
                    onClick={() => add.mutate(lane.id)}
                    disabled={add.isPending}
                  >
                    <Plus />
                  </Button>
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("Действия столбца")}
                        />
                      }
                    >
                      ⋯
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onClick={() => setRenameLane(lane.id)}>
                        {t("Переименовать")}
                      </MenuItem>
                      <MenuItem onClick={() => add.mutate(lane.id)}>
                        {t("Добавить секцию")}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              </ContextMenuTrigger>
              <MenuContent>
                <MenuItem onClick={() => setRenameLane(lane.id)}>
                  {t("Переименовать")}
                </MenuItem>
                <MenuItem onClick={() => add.mutate(lane.id)}>
                  {t("Добавить секцию")}
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("bordena:board-layout", {
                        detail: dashboard.id,
                      })
                    )
                  }
                >
                  {t("Компоновка…")}
                </MenuItem>
              </MenuContent>
            </ContextMenu>
            {!sections.length && (
              <Button
                variant="muted"
                className="bordena-add-section mb-2 w-full"
                disabled={add.isPending}
                onClick={() => add.mutate(lane.id)}
              >
                <Plus aria-hidden="true" />
                {t("Добавить секцию")}
              </Button>
            )}
            {add.isError && (
              <p role="alert" className="p-2 text-xs text-destructive">
                {add.error.message}
              </p>
            )}
            <Droppable droppableId={`lane:${lane.id}`} type="SECTION">
              {(laneProvided, laneSnapshot) => (
                <div
                  ref={laneProvided.innerRef}
                  {...laneProvided.droppableProps}
                  className="min-h-20 rounded-lg"
                  style={{
                    minHeight: sections.length
                      ? "calc(100% - 48px)"
                      : undefined,
                  }}
                  data-section-target={laneSnapshot.isDraggingOver || undefined}
                >
                  {sections.map((column, index) => {
                    const section = sectionPlacement(layout, column)
                    return (
                      <Draggable
                        key={column.id}
                        draggableId={`section:${column.id}`}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <section
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={provided.draggableProps.style}
                            aria-label={t("Секция: {p0}", { p0: column.title })}
                            className={
                              snapshot.isDragging
                                ? "rounded-xl bg-background shadow-xl ring-2 ring-primary/60"
                                : undefined
                            }
                          >
                            {renderSection(column, section.collapsed, {
                              leading: null,
                              headerDragProps: provided.dragHandleProps,
                              onCollapse: () =>
                                change((l) => ({
                                  ...l,
                                  sections: {
                                    ...l.sections,
                                    [column.id]: {
                                      ...sectionPlacement(l, column),
                                      collapsed: !sectionPlacement(l, column)
                                        .collapsed,
                                    },
                                  },
                                })),
                              autoRename: autoRenameId === column.id,
                              menu: (
                                <SectionCommands
                                  canUp={index > 0}
                                  canDown={index < sections.length - 1}
                                  onUp={() =>
                                    move(column.id, lane.id, index - 1)
                                  }
                                  onDown={() =>
                                    move(column.id, lane.id, index + 1)
                                  }
                                  onSettings={() => setSettingsId(column.id)}
                                />
                              ),
                            })}
                          </section>
                        )}
                      </Draggable>
                    )
                  })}
                  {laneProvided.placeholder}
                </div>
              )}
            </Droppable>
            {!sections.length && (
              <Droppable droppableId={`free-lane|${lane.id}`} type="DEFAULT">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    data-empty-lane={lane.id}
                    className={`mt-1 min-h-44 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground ${snapshot.isDraggingOver ? "border-primary bg-primary/10" : "border-border/60"}`}
                  >
                    {t(
                      "Перетащите карточку сюда — секция появится автоматически"
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
        )
      })}
      {selected && selectedPlacement && (
        <SectionOptions
          title={selected.title}
          layout={layout}
          laneId={selectedPlacement.laneId}
          mode={selectedPlacement.progressMode}
          open
          onOpenChange={(value) => {
            if (!value) setSettingsId(null)
          }}
          onLane={(laneId) =>
            move(
              selected.id,
              laneId,
              sectionsInLane(layout, board.columns, laneId).filter(
                (c) => c.id !== selected.id
              ).length
            )
          }
          onMode={(progressMode) =>
            change((l) => ({
              ...l,
              sections: {
                ...l.sections,
                [selected.id]: {
                  ...sectionPlacement(l, selected),
                  progressMode,
                },
              },
            }))
          }
        />
      )}
    </>
  )
}
export function MatrixBoard({
  dashboard,
  board,
  onPatch,
  onAdd,
  release,
  addDisabledReason,
  progressOf,
}: {
  dashboard: Dashboard
  board: Board
  onPatch: (id: string, patch: CardPatch) => void
  onAdd: (stageId: string, stateId: string) => void
  release: (id: string) => void
  addDisabledReason?: string
  progressOf: ProgressReader
}) {
  const t = useT()
  const layout = dashboard.layout!
  const { mutate: change } = useLayoutChange(dashboard.id)
  const groups = new Map<string, Card[]>()
  for (const card of board.cards) {
    const axes = cardAxes(card, layout),
      key = `${axes.stageId}|${axes.stateId}`
    const group = groups.get(key) ?? []
    group.push(card)
    groups.set(key, group)
  }
  const cols = new Map(board.columns.map((c) => [c.id, c]))
  const grid = `160px repeat(${layout.stages.length}, 320px)`
  return (
    <div className="min-w-max pb-8" data-matrix="true">
      <div
        className="sticky top-0 z-10 grid bg-background"
        style={{ gridTemplateColumns: grid }}
      >
        <div className="p-3 text-xs text-muted-foreground">
          {t("Состояние / этап")}{" "}
        </div>
        {layout.stages.map((stage) => (
          <div
            key={stage.id}
            className="border-b p-3 text-sm font-semibold"
            style={
              stage.color && columnHue(stage.color) != null
                ? {
                    backgroundColor: `oklch(0.7 0.13 ${columnHue(stage.color)} / 0.13)`,
                  }
                : undefined
            }
          >
            {stage.title}
          </div>
        ))}
      </div>
      {layout.states.map((state) => (
        <div
          className="grid border-b"
          key={state.id}
          style={{ gridTemplateColumns: grid }}
        >
          <div className="sticky left-0 z-1 bg-background p-2">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={!state.collapsed}
              aria-label={t("{p0} строку: {p1}", {
                p0: state.collapsed ? t("Развернуть") : t("Свернуть"),
                p1: state.title,
              })}
              onClick={() =>
                change((l) => ({
                  ...l,
                  states: l.states.map((s) =>
                    s.id === state.id ? { ...s, collapsed: !s.collapsed } : s
                  ),
                }))
              }
            >
              {state.collapsed ? "▸" : "▾"} {state.title}
            </Button>
          </div>
          {layout.stages.map((stage) => (
            <Droppable
              key={stage.id}
              droppableId={`matrix|${stage.id}|${state.id}`}
              isDropDisabled={state.collapsed}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  data-matrix-cell={`${stage.id}|${state.id}`}
                  data-collapsed={state.collapsed ? "true" : "false"}
                  className="min-h-16 border-l p-2"
                  style={{
                    backgroundColor: snapshot.isDraggingOver
                      ? "var(--accent)"
                      : layout.tint && columnHue(state.color ?? "") != null
                        ? `oklch(0.7 0.1 ${columnHue(state.color ?? "")} / 0.05)`
                        : undefined,
                  }}
                >
                  {!state.collapsed && (
                    <>
                      {sortCards(
                        (groups.get(`${stage.id}|${state.id}`) ?? []).sort(
                          byPosition
                        ),
                        dashboard.sort ?? [],
                        progressOf
                      ).map((card, index) => (
                        <DraggableCard
                          key={card.id}
                          card={card}
                          layout={layout}
                          presentationProgress={progressOf(card) ?? null}
                          column={cols.get(card.columnId)!}
                          index={index}
                          showBody
                          compact={false}
                          vanishOnDrop={false}
                          onPatch={onPatch}
                          onDropSettled={release}
                        />
                      ))}
                      {board.columns[0] && (
                        <MirrorList
                          dashboard={dashboard}
                          column={board.columns[0]}
                          axes={{ stageId: stage.id, stateId: state.id }}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!!addDisabledReason}
                        title={addDisabledReason}
                        aria-label={t("Добавить карточку: {p0}, {p1}", {
                          p0: stage.title,
                          p1: state.title,
                        })}
                        onClick={() => onAdd(stage.id, state.id)}
                      >
                        {t("+ Карточка")}{" "}
                      </Button>
                    </>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      ))}
    </div>
  )
}
