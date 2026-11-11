import { expect, it } from "vitest"
import { CardSchema, ColumnSchema } from "@bordena/contract"
import { initialLayout, type Board } from "@bordena/core"
import type { DropResult } from "@hello-pangea/dnd"
import { matrixDrop } from "./matrix-drop"
const col = ColumnSchema.parse({
  id: "col",
  dashboardId: "board",
  title: "A",
  position: "a0",
  updatedAt: 1,
  deletedAt: null,
})
const card = CardSchema.parse({
  id: "card",
  columnId: "col",
  title: "T",
  body: "- [x] Markdown",
  position: "a0",
  updatedAt: 1,
  deletedAt: null,
})
const board: Board = { columns: [col], cards: [card] },
  layout = initialLayout([col], "matrix")
layout.stages.push({ id: "stage-2", title: "Next" })
layout.states.push({ id: "state-2", title: "Frozen" })
const drop = (droppableId: string) =>
  ({
    draggableId: "card",
    destination: { droppableId, index: 0 },
  }) as DropResult
it("moves both matrix axes while preserving the free section and Markdown", () => {
  const [moved] = matrixDrop(board, layout, [], drop("matrix|stage-2|state-2"))
  expect(moved).toMatchObject({
    id: "card",
    columnId: "col",
    stageId: "stage-2",
    stateId: "state-2",
    body: card.body,
  })
  expect(card.stageId).toBeUndefined()
})
it("rejects missing and invalid drop destinations without changing cards", () => {
  expect(
    matrixDrop(board, layout, [], { ...drop(""), destination: null })
  ).toEqual([])
  expect(matrixDrop(board, layout, [], drop("matrix|missing|state-2"))).toEqual(
    []
  )
})
it("assigns an ordered position before a card in the destination cell", () => {
  const target = {
    ...card,
    id: "target",
    stageId: "stage-2",
    stateId: "state-2",
  }
  const [moved] = matrixDrop(
    { ...board, cards: [card, target] },
    layout,
    [],
    drop("matrix|stage-2|state-2")
  )
  expect(moved.position < target.position).toBe(true)
})
