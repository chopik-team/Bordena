import { describe, expect, it } from "vitest"
import { CardSchema, ColumnSchema, DashboardSchema } from "@bordena/contract"
import { initialLayout } from "../src/board-layout"
import {
  linkedProgress,
  synchronizeLinks,
  validateLinks,
  validateFieldValues,
  type BoardLink,
  type LinkedModel,
} from "../src/linked-boards"
function model(): LinkedModel {
  const columns = ["p", "a", "b"].map((id, i) =>
    ColumnSchema.parse({
      id,
      title: id,
      dashboardId: i ? "child" : "parent",
      position: `a${i}`,
      done: id === "b",
      updatedAt: 1,
      deletedAt: null,
    })
  )
  const dashboards = ["parent", "child"].map((id) =>
    DashboardSchema.parse({
      id,
      title: id,
      position: "a0",
      layout: initialLayout(
        columns.filter((c) => c.dashboardId === id),
        "free"
      ),
      updatedAt: 1,
      deletedAt: null,
    })
  )
  const cards = [
    { id: "parent-card", columnId: "p", progress: 37 },
    { id: "work", columnId: "a", progress: 0 },
    { id: "done", columnId: "b", progress: 100 },
  ].map((c) =>
    CardSchema.parse({
      ...c,
      title: c.id,
      body: "ё",
      position: "a0",
      updatedAt: 1,
      deletedAt: null,
    })
  )
  return { columns, dashboards, cards }
}
const link = (patch: Partial<BoardLink> = {}): BoardLink => ({
  schemaVersion: 1,
  boardId: "child",
  mode: "progress",
  source: { type: "tasks" },
  rules: [],
  requireFullCoverage: true,
  ...patch,
})
describe("linked boards", () => {
  it("uses the same explicit state completion as deadlines without guessing titles", () => {
    const m = model(),
      layout = m.dashboards[1].layout!
    layout.states.push(
      { id: "closed", title: "Любое имя", done: true },
      { id: "frozen", title: "Closed", done: false }
    )
    m.cards[1].stateId = "closed"
    m.cards[2].stateId = "frozen"
    expect(linkedProgress(m, link()).value).toBe(50)
    m.cards[2].stateId = "closed"
    expect(linkedProgress(m, link()).value).toBe(100)
    // A deliberately chosen source overrides the default completion policy.
    expect(
      linkedProgress(
        m,
        link({ source: { type: "tasks", completedColumnIds: ["a"] } })
      ).value
    ).toBe(50)
  })
  it("calculates completion, explicit states, selected manual values, manual board and stages", () => {
    const m = model()
    expect(linkedProgress(m, link()).value).toBe(50)
    expect(
      linkedProgress(
        m,
        link({ source: { type: "selected", cardIds: ["done"] } })
      ).value
    ).toBe(100)
    expect(linkedProgress(m, link({ source: { type: "manual" } }))).toEqual({
      value: null,
      reason: "unset",
    })
    m.dashboards[1].progress = 19
    expect(linkedProgress(m, link({ source: { type: "manual" } })).value).toBe(
      19
    )
    expect(
      linkedProgress(
        m,
        link({
          source: {
            type: "stages",
            stageValues: [
              { id: "a", value: 25 },
              { id: "b", value: 75 },
            ],
          },
        })
      ).value
    ).toBe(50)
    m.cards[1].stateId = "state-active"
    expect(
      linkedProgress(
        m,
        link({
          source: {
            type: "tasks",
            completedColumnIds: [],
            completedStateIds: ["state-active"],
          },
        })
      ).value
    ).toBe(100)
  })
  it("does not invent percentages for empty/missing boards or undefined manual values", () => {
    const m = model()
    m.cards = m.cards.slice(0, 1)
    expect(linkedProgress(m, link())).toEqual({ value: null, reason: "empty" })
    m.dashboards[1].deletedAt = 2
    expect(linkedProgress(m, link())).toEqual({
      value: null,
      reason: "missing",
    })
  })
  it("rejects self links, two-board cycles and longer cycles", () => {
    const m = model()
    m.cards[0].boardLink = link({ boardId: "parent" })
    expect(() => validateLinks(m)).toThrow(/Cyclic/)
    m.cards[0].boardLink = link()
    m.cards[1].boardLink = link({ boardId: "parent" })
    expect(() => validateLinks(m)).toThrow(/Cyclic/)
    m.dashboards.push({ ...m.dashboards[1], id: "third" })
    m.columns.push({ ...m.columns[1], id: "c", dashboardId: "third" })
    m.cards.push({
      ...m.cards[1],
      id: "c-card",
      columnId: "c",
      boardLink: link({ boardId: "parent" }),
    })
    m.cards[1].boardLink = link({ boardId: "third" })
    expect(() => validateLinks(m)).toThrow(/Cyclic/)
  })
  it("accepts a diamond dependency graph", () => {
    const m = model()
    m.cards[0].boardLink = link()
    m.cards.push({ ...m.cards[0], id: "parent-two" })
    expect(() => validateLinks(m)).not.toThrow()
  })
  it("validates overlapping, missing and unknown target ranges", () => {
    const m = model()
    m.cards[0].boardLink = link({
      mode: "auto-move",
      rules: [
        { min: 0, max: 50, stageId: "p" },
        { min: 50, max: 100, stageId: "p" },
      ],
    })
    expect(() => validateLinks(m)).toThrow(/overlap/)
    m.cards[0].boardLink.rules[1].min = 52
    expect(() => validateLinks(m)).toThrow(/cover/)
    m.cards[0].boardLink.requireFullCoverage = false
    expect(() => validateLinks(m)).not.toThrow()
    m.cards[0].boardLink.rules[1].stageId = "absent"
    expect(() => validateLinks(m)).toThrow(/stage/)
  })
  it("updates separate derived progress and never overwrites manual progress or state", () => {
    const m = model()
    m.cards[0].boardLink = link({
      mode: "auto-move",
      rules: [{ min: 0, max: 100, stageId: "p" }],
    })
    m.cards[0].stateId = "state-active"
    const plan = synchronizeLinks(m, ["child"])
    expect(plan.cards[0]).toMatchObject({
      progress: 37,
      linkedProgress: { value: 50 },
      stateId: "state-active",
      columnId: "p",
    })
    m.cards[0] = plan.cards[0]
    expect(synchronizeLinks(m, ["child"]).cards).toEqual([])
  })
  it("consumes linked movement events and preserves a manual return until the child changes", () => {
    const m = model()
    m.dashboards[0].layout!.stages.push({ id: "other", title: "Other" })
    m.cards[0].boardLink = link({
      mode: "auto-move",
      rules: [{ min: 0, max: 100, stageId: "p" }],
    })
    m.cards[0] = synchronizeLinks(m, ["child"]).cards[0]
    m.cards[0].stageId = "other"
    expect(synchronizeLinks(m, ["child"]).cards).toEqual([])
    m.cards[1].columnId = "b"
    const plan = synchronizeLinks(m, ["child"])
    expect(plan.cards[0].stageId).toBe("p")
    expect(plan.moves).toHaveLength(1)
  })
  it("keeps linked movement paused in archived parent contexts", () => {
    const m = model()
    m.dashboards[0].layout!.stages.push({ id: "target", title: "Target" })
    m.cards[0].boardLink = link({
      mode: "auto-move",
      rules: [{ min: 0, max: 100, stageId: "target" }],
    })
    m.archivedBoardIds = ["parent"]
    const plan = synchronizeLinks(m, ["child"])
    expect(plan.moves).toEqual([])
    expect(plan.cards[0].stageId).toBeUndefined()
    expect(plan.cards[0].linkedProgress?.value).toBe(50)
  })
  it("navigation creates no calculated progress or move", () => {
    const m = model()
    m.cards[0].boardLink = link({ mode: "navigation" })
    expect(synchronizeLinks(m, ["child"])).toEqual({ cards: [], moves: [] })
  })
  it("retains parent and manual value when a child is deleted and recovers with the same ID", () => {
    const m = model()
    m.cards[0].boardLink = link()
    m.dashboards[1].deletedAt = 2
    const deleted = synchronizeLinks(m, ["child"]).cards[0]
    expect(deleted).toMatchObject({
      id: "parent-card",
      progress: 37,
      boardLink: { boardId: "child" },
      linkedProgress: { value: null, reason: "missing" },
    })
    m.cards[0] = deleted
    m.dashboards[1].deletedAt = null
    m.dashboards[1].title = "Renamed"
    expect(synchronizeLinks(m, ["child"]).cards[0].linkedProgress?.value).toBe(
      50
    )
  })
  it("only recalculates affected dependencies", () => {
    const m = model()
    m.cards[0].boardLink = link()
    expect(synchronizeLinks(m, ["parent"]).cards).toEqual([])
  })
  it("propagates selected derived progress through a chain", () => {
    const m = model()
    m.cards[0].boardLink = link()
    m.dashboards.push({ ...m.dashboards[0], id: "grand" })
    m.columns.push({ ...m.columns[0], id: "g", dashboardId: "grand" })
    m.cards.push({
      ...m.cards[0],
      id: "grand-card",
      columnId: "g",
      boardLink: link({ boardId: "parent", source: { type: "selected" } }),
    })
    expect(
      synchronizeLinks(m, ["child"]).cards.find((c) => c.id === "grand-card")
        ?.linkedProgress?.value
    ).toBe(50)
  })
  it("recalculates dependencies before parents on startup without intermediate moves", () => {
    const m = model()
    m.cards[0].boardLink = link()
    m.cards[0].linkedProgress = { value: 0, reason: "available" }
    m.dashboards.unshift({ ...m.dashboards[0], id: "grand" })
    m.columns.push({ ...m.columns[0], id: "g", dashboardId: "grand" })
    m.dashboards[0].layout = initialLayout([m.columns.at(-1)!], "matrix")
    m.dashboards[0].layout.stages.push({ id: "g-ready", title: "Ready" })
    m.cards.push({
      ...m.cards[0],
      id: "grand-card",
      columnId: "g",
      stageId: "g-ready",
      boardLink: link({
        boardId: "parent",
        mode: "auto-move",
        source: { type: "selected" },
        rules: [
          { min: 0, max: 49, stageId: "g" },
          { min: 50, max: 100, stageId: "g-ready" },
        ],
      }),
    })
    const plan = synchronizeLinks(m, ["parent", "grand", "child"])
    expect(
      plan.cards.find((c) => c.id === "grand-card")?.linkedProgress?.value
    ).toBe(50)
    expect(plan.moves).toEqual([])
  })
  it("moves into an explicitly configured free section with a unique position", () => {
    const m = model(),
      target = { ...m.columns[0], id: "p-target", position: "a1" }
    m.columns.push(target)
    m.dashboards[0].layout = initialLayout(
      m.columns.filter((c) => c.dashboardId === "parent"),
      "free"
    )
    m.cards.push({
      ...m.cards[0],
      id: "existing",
      columnId: "p-target",
      position: "a5",
    })
    m.cards[0].boardLink = link({
      mode: "auto-move",
      rules: [{ min: 0, max: 100, stageId: "p-target", columnId: "p-target" }],
    })
    m.cards[0].stateId = "state-active"
    const moved = synchronizeLinks(m, ["child"]).cards[0]
    expect(moved).toMatchObject({
      columnId: "p-target",
      stateId: "state-active",
      progress: 37,
    })
    expect(moved.position > "a5").toBe(true)
    m.cards[0] = moved
    expect(synchronizeLinks(m, ["child"]).moves).toEqual([])
  })
  it("validates custom types, percentages and selection options", () => {
    const card = model().cards[0]
    card.fieldValues = { estimate: 125 }
    expect(() =>
      validateFieldValues(card, [
        { id: "estimate", title: "Estimate", type: "percent" },
      ])
    ).toThrow()
    card.fieldValues = { estimate: 25 }
    expect(() =>
      validateFieldValues(card, [
        { id: "estimate", title: "Estimate", type: "percent" },
      ])
    ).not.toThrow()
    card.fieldValues = { choice: "bad" }
    expect(() =>
      validateFieldValues(card, [
        { id: "choice", title: "Choice", type: "select", options: ["ok"] },
      ])
    ).toThrow()
  })
})
