import { beforeEach, describe, expect, it } from "vitest"
import { CardSchema, DashboardSchema } from "@bordena/contract"
import { cardAxes, initialLayout, validateLayout } from "../src/board-layout"
import { sortCards } from "../src/utils/sort-cards"
import { installMemoryRuntime, rows } from "./memory-runtime"
import { db } from "../src/api/db/db"
import { moveCard } from "../src/api/operations/move-card"
import { updateCard } from "../src/api/operations/update-card"
import { runtime, installRuntime } from "../src/runtime"
import { moveCardToColumn } from "../src/api/operations/move-card-to-column"
import type { Card, Column } from "../src/types"

const columns: Column[] = ["a", "b"].map((id, i) => ({
  id,
  title: id,
  dashboardId: "board",
  position: `a${i}`,
  color: "",
  done: false,
  collapsed: false,
  stamps: {},
  updatedAt: 1,
  deletedAt: null,
}))
const card = (patch: Partial<Card> = {}): Card =>
  CardSchema.parse({
    id: "card",
    title: "Кириллица",
    body: "- [x] готово",
    columnId: "a",
    position: "a0",
    updatedAt: 1,
    deletedAt: null,
    ...patch,
  })
beforeEach(installMemoryRuntime)
describe("Bordena normalized layouts and progress", () => {
  it("creates a deterministic layout without rewriting old records or guessing state from column names", () => {
    const layout = initialLayout(columns, "free")
    expect(layout.lanes).toHaveLength(2)
    expect(cardAxes(card(), layout)).toEqual({
      stageId: "a",
      stateId: "state-active",
    })
    expect(card().stageId).toBeUndefined()
    expect(initialLayout([], "matrix").stages).toHaveLength(1)
  })
  it("moves a section without changing any card axis", () => {
    const l = initialLayout(columns, "free"),
      before = cardAxes(card(), l)
    l.sections.a.laneId = l.lanes[1].id
    expect(cardAxes(card(), validateLayout(l))).toEqual(before)
  })
  it("rejects duplicate axes and dangling section mappings", () => {
    const l = initialLayout(columns, "matrix")
    expect(() =>
      validateLayout({ ...l, stages: [l.stages[0], l.stages[0]] })
    ).toThrow()
    l.sections.a.laneId = "unknown"
    expect(() => validateLayout(l)).toThrow()
  })
  it("materializes the original axes when moving a legacy card between free sections", async () => {
    const layout = initialLayout(columns, "free")
    await db.setDashboard(
      DashboardSchema.parse({
        id: "board",
        title: "Board",
        position: "a0",
        updatedAt: 1,
        deletedAt: null,
        layout,
      })
    )
    await db.setCard(card())
    for (const col of columns) await db.setColumn(col)
    await moveCard("board", [card({ columnId: "b" })])
    expect(await db.getCard("card")).toMatchObject({
      columnId: "b",
      stageId: "a",
      stateId: "state-active",
      body: "- [x] готово",
    })
  })
  it("matrix movement changes the axes and preserves the free section and content", async () => {
    const layout = initialLayout(columns, "matrix")
    layout.states.push({ id: "frozen", title: "Заморожено" })
    await db.setDashboard(
      DashboardSchema.parse({
        id: "board",
        title: "B",
        position: "a0",
        updatedAt: 1,
        deletedAt: null,
        layout,
      })
    )
    await db.setCard(card())
    for (const col of columns) await db.setColumn(col)
    await moveCard("board", [
      card({ stageId: "b", stateId: "frozen", position: "a1" }),
    ])
    expect(await db.getCard("card")).toMatchObject({
      columnId: "a",
      stageId: "b",
      stateId: "frozen",
      position: "a1",
      body: "- [x] готово",
    })
  })
  it.each([0, 100, 65.5, null])(
    "persists manual progress %s independently of Markdown",
    async (progress) => {
      await db.setCard(card())
      await updateCard("card", { progress })
      expect(await db.getCard("card")).toMatchObject({
        progress,
        body: "- [x] готово",
      })
    }
  )
  it.each([-1, 101, NaN, Infinity])(
    "refuses invalid progress %s before writing",
    async (progress) => {
      await db.setCard(card())
      await expect(updateCard("card", { progress })).rejects.toThrow()
      expect((await db.getCard("card"))?.progress).toBeUndefined()
    }
  )
  it("sorts zero and 100 before unset values, breaking ties with saved position", () => {
    const cards = [
      card({ id: "unset" }),
      card({ id: "100", progress: 100 }),
      card({ id: "zero", progress: 0 }),
      card({ id: "null", progress: null, position: "a1" }),
    ]
    expect(sortCards(cards, ["progress"]).map((c) => c.id)).toEqual([
      "zero",
      "100",
      "unset",
      "null",
    ])
  })
  it("local cross-board move keeps card identity and attachment keys", async () => {
    installRuntime({
      ...runtime(),
      files: {} as NonNullable<ReturnType<typeof runtime>["files"]>,
    })
    for (const col of columns) await db.setColumn(col)
    await db.setColumn({ ...columns[1], dashboardId: "other" })
    await db.setCard(
      card({
        progress: 65,
        stageId: "a",
        attachments: [
          {
            id: "file",
            name: "файл",
            key: "att/12345678-1234-1234-1234-123456789abc",
            size: 1,
            mime: "text/plain",
          },
        ],
      })
    )
    expect(await moveCardToColumn("card", "b")).toBe("card")
    expect(await db.getCard("card")).toMatchObject({
      columnId: "b",
      progress: 65,
      deletedAt: null,
      stageId: undefined,
    })
    expect((await db.getCard("card"))!.attachments).toHaveLength(1)
    expect([...rows.keys()].filter((k) => k.startsWith("cards/"))).toHaveLength(
      1
    )
  })
})
