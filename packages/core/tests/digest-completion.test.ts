import { describe, it, expect } from "vitest"
import { CardSchema, ColumnSchema } from "@bordena/contract"
import { boardDigest, groupByDeadline } from "../src/api/operations/get-digest"
import { initialLayout } from "../src/board-layout"

describe("digest deadline and completion consistency", () => {
  const column = ColumnSchema.parse({
    id: "a",
    dashboardId: "b",
    title: "Работа",
    position: "a0",
    updatedAt: 1,
    deletedAt: null,
  })
  const card = (id: string, deadline: string, stateId?: string) =>
    CardSchema.parse({
      id,
      columnId: "a",
      title: id,
      body: "",
      deadline,
      stateId,
      position: "a0",
      updatedAt: 1,
      deletedAt: null,
    })
  it("offers state completion targets while preserving the original free section", () => {
    const layout = initialLayout([column], "matrix")
    layout.states.push(
      { id: "closed", title: "Переименовано", done: true },
      { id: "active", title: "Работа", done: false }
    )
    const entries = boardDigest(
      { columns: [column], cards: [card("c", "2026-10-18T09:00", "closed")] },
      "Board",
      layout
    )
    expect(entries[0]).toMatchObject({
      isDone: true,
      doneStateId: "closed",
      undoneStateId: "active",
      doneColumnId: null,
    })
    expect(entries[0].card.columnId).toBe("a")
  })
  it("groups expired times today as overdue but leaves date-only and completed tasks alone", () => {
    const entries = boardDigest(
      {
        columns: [column],
        cards: [
          card("expired", "2026-10-18T09:00"),
          card("day", "2026-10-18"),
          card("later", "2026-10-18T17:00"),
        ],
      },
      "Board"
    )
    const groups = groupByDeadline(
      entries,
      "2026-10-18",
      new Date("2026-10-18T12:00").getTime()
    )
    expect(groups[0].entries.map((e) => e.card.id)).toEqual(["expired"])
    expect(groups[1].entries.map((e) => e.card.id).sort()).toEqual([
      "day",
      "later",
    ])
    entries[0].isDone = true
    expect(
      groupByDeadline(
        entries,
        "2026-10-18",
        new Date("2026-10-18T12:00").getTime()
      ).some((g) => g.kind === "overdue")
    ).toBe(false)
  })
})
