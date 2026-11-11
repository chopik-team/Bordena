import type { DropResult } from "@hello-pangea/dnd"
import {
  byPosition,
  cardAxes,
  dropNeighbours,
  keyBetween,
  sortCards,
  type Board,
  type BoardLayout,
  type Card,
  type ProgressReader,
} from "@bordena/core"
export function matrixDrop(
  board: Board,
  layout: BoardLayout,
  sort: string[],
  result: DropResult,
  progressOf?: ProgressReader
): Card[] {
  const { destination, draggableId } = result
  if (!destination) return []
  const [prefix, stageId, stateId] = destination.droppableId.split("|")
  if (
    prefix !== "matrix" ||
    !layout.stages.some((s) => s.id === stageId) ||
    !layout.states.some((s) => s.id === stateId)
  )
    return []
  const moved = board.cards.find((c) => c.id === draggableId)
  if (!moved) return []
  const order = sortCards(
    board.cards
      .filter((c) => {
        const axes = cardAxes(c, layout)
        return (
          c.id !== draggableId &&
          axes.stageId === stageId &&
          axes.stateId === stateId
        )
      })
      .sort(byPosition),
    sort,
    progressOf
  )
  const activeSort =
    layout.sections[moved.columnId]?.progressMode === "position"
      ? sort.filter((key) => key !== "progress")
      : sort
  const [prev, next] = dropNeighbours(
    order,
    destination.index,
    moved,
    activeSort,
    progressOf
  )
  const position = keyBetween(prev, next)
  return position == null ? [] : [{ ...moved, stageId, stateId, position }]
}
