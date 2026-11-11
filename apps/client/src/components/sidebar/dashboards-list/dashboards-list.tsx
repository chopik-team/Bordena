import { useUiFlag } from "@/lib/ui-state"
import { useT } from "@bordena/i18n"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  cn,
} from "@bordena/ui-kit"
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd"
import { useCollapsedFolders, useSidebarTree } from "@bordena/core"
import { useState } from "react"
import { DROP_ANIMATION_MS } from "@/lib/hooks"
import { OrderAnimator } from "../../card/order-animator"
import { DragStateProvider } from "../../deck/drag-state"
import { BoardItem } from "./board-item"
import { BoardsHeader } from "./boards-header"
import { FolderItem } from "./folder/folder-item"
import { flattenTree } from "./sidebar-drop"
import { useSidebarDrag } from "./use-sidebar-drag"
import { usePreferences } from "@/lib/preferences"
import { scopedTree, scopedRootIndex } from "@/lib/workspaces"
interface IProps {
  activeDashboardId: string
  sharedIds: string[]
  publishedIds: string[]
}
export function DashboardsList({
  activeDashboardId,
  sharedIds,
  publishedIds,
}: IProps) {
  const t = useT()
  const [collapsed] = useUiFlag("collapsed:boards")
  const { data: allNodes = [] } = useSidebarTree()
  const { workspaceId, showArchived } = usePreferences()
  const nodes = scopedTree(allNodes, workspaceId, showArchived)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const collapsedIds = useCollapsedFolders()
  const rows = flattenTree(nodes, collapsedIds)
  const {
    dragging,
    draggingFolderId,
    landingFolderId,
    responders,
    onPointerDown,
  } = useSidebarDrag(rows, (move) => {
    if (move.target.kind === "root")
      return {
        ...move,
        target: {
          ...move.target,
          index: scopedRootIndex(allNodes, nodes, move.id, move.target.index),
        },
      }
    const targetId = move.target.folderId
    const full = allNodes.find(
      (node) => node.type === "folder" && node.id === targetId
    )
    const shown = nodes.find(
      (node) => node.type === "folder" && node.id === targetId
    )
    if (full?.type !== "folder" || shown?.type !== "folder") return move
    const all = full.boards.filter((b) => b.id !== move.id),
      visible = shown.boards.filter((b) => b.id !== move.id)
    const next = visible[move.target.index],
      last = visible.at(-1)
    return {
      ...move,
      target: {
        ...move.target,
        index: next
          ? all.findIndex((b) => b.id === next.id)
          : last
            ? all.findIndex((b) => b.id === last.id) + 1
            : all.length,
      },
    }
  })
  const shared = new Set(sharedIds)
  const published = new Set(publishedIds)
  const intoFolder = landingFolderId !== null
  const lifted = (dragging: boolean) =>
    dragging ? "rounded-md bg-sidebar shadow-e2" : undefined
  return (
    <SidebarGroup className="bordena-boards-group">
      <BoardsHeader onFolderCreated={setRenamingId} />
      <SidebarGroupContent hidden={collapsed}>
        <DragStateProvider value={dragging}>
          <DragDropContext
            {...responders}
            dragHandleUsageInstructions={t(
              "Space — начать перенос, стрелки — выбрать позицию, Space — подтвердить, Esc — отменить."
            )}
            onDragStart={(start, provided) => {
              responders.onDragStart(start)
              provided.announce(t("Перенос начат."))
            }}
            onDragUpdate={(update, provided) => {
              responders.onDragUpdate(update)
              provided.announce(
                t("Позиция переноса: {position}", {
                  position: update.destination
                    ? update.destination.index + 1
                    : "—",
                })
              )
            }}
            onDragEnd={(result, provided) => {
              responders.onDragEnd(result)
              provided.announce(
                t(
                  result.reason === "CANCEL"
                    ? "Перенос отменён."
                    : "Перенос завершён."
                )
              )
            }}
          >
            <Droppable droppableId="sidebar">
              {(provided) => (
                <SidebarMenu
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="-mt-1 space-y-0"
                  onPointerDown={onPointerDown}
                >
                  {rows.map((row, index) => (
                    <Draggable
                      key={row.id}
                      draggableId={row.id}
                      index={index}
                      disableInteractiveElementBlocking
                      isDragDisabled={
                        row.id === renamingId || row.type === "empty"
                      }
                    >
                      {(dragProvided, snapshot) => (
                        <SidebarMenuItem
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          role="listitem"
                          style={{
                            ...dragProvided.draggableProps.style,
                            ...(snapshot.isDropAnimating && {
                              transitionDuration: `${DROP_ANIMATION_MS}ms`,
                            }),
                          }}
                          className={cn(
                            row.type !== "folder" &&
                              draggingFolderId !== null &&
                              row.folderId === draggingFolderId &&
                              "h-0 overflow-hidden"
                          )}
                        >
                          <OrderAnimator>
                            {row.type === "empty" ? (
                              <div
                                className={cn(
                                  "ml-4 overflow-hidden transition-[height] duration-150",
                                  row.hidden ? "h-0" : "h-9"
                                )}
                              >
                                <div className="mt-1 flex h-8 items-center px-2 text-xs text-muted-foreground/60">
                                  {t("Пока нет досок")}{" "}
                                </div>
                              </div>
                            ) : row.type === "board" ? (
                              <div
                                className={cn(
                                  "pt-1",
                                  (snapshot.isDragging
                                    ? intoFolder
                                    : row.folderId) && "ml-4",
                                  snapshot.isDragging &&
                                    "transition-[margin] duration-150"
                                )}
                              >
                                <div className={lifted(snapshot.isDragging)}>
                                  <BoardItem
                                    dashboard={row.dashboard}
                                    isActive={row.id === activeDashboardId}
                                    isPublished={published.has(row.id)}
                                    isShared={shared.has(row.id)}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="pt-1">
                                <div className={lifted(snapshot.isDragging)}>
                                  <FolderItem
                                    node={row.node}
                                    collapsed={row.collapsed}
                                    renaming={row.id === renamingId}
                                    isDropTarget={row.id === landingFolderId}
                                    onRenameStart={() => setRenamingId(row.id)}
                                    onRenameEnd={() => setRenamingId(null)}
                                  />
                                </div>
                              </div>
                            )}
                          </OrderAnimator>
                        </SidebarMenuItem>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </SidebarMenu>
              )}
            </Droppable>
          </DragDropContext>
        </DragStateProvider>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
