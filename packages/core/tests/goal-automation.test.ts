import { describe, expect, it } from "vitest"
import {
  CardSchema,
  ColumnSchema,
  DashboardSchema,
  GoalPathSchema,
  AutomationRuleSchema,
  type AutomationRule,
  type GoalMetric,
} from "@bordena/contract"
import { initialLayout } from "../src/board-layout"
import {
  goalProgress,
  metricProgress,
  recordGoalMeasurement,
  setGoalStep,
} from "../src/goal-path"
import {
  planAutomation,
  reconcileAutomation,
  nextAutomationDeadline,
  rebaseAutomationAfterUndo,
} from "../src/automation"
import { linkedProgress, type LinkedModel } from "../src/linked-boards"
const now = new Date("2026-10-18T12:00:00+03:00").getTime()
function model(): LinkedModel {
  const columns = ["todo", "done"].map((id, i) =>
    ColumnSchema.parse({
      id,
      title: id,
      dashboardId: "board",
      position: `a${i}`,
      done: i === 1,
      updatedAt: 1,
      deletedAt: null,
    })
  )
  return {
    columns,
    dashboards: [
      DashboardSchema.parse({
        id: "board",
        title: "Goal",
        position: "a0",
        layout: initialLayout(columns, "free"),
        goalPath: goal(),
        updatedAt: 1,
        deletedAt: null,
      }),
    ],
    cards: [
      CardSchema.parse({
        id: "card",
        title: "Task",
        body: "",
        columnId: "todo",
        position: "a0",
        deadline: "2026-10-17",
        updatedAt: 1,
        deletedAt: null,
      }),
    ],
  }
}
function goal() {
  return GoalPathSchema.parse({
    schemaVersion: 1,
    progressMode: "stages",
    manualProgress: 37,
    steps: [
      { id: "todo", status: "not-started", required: true },
      { id: "done", status: "not-started", required: false },
    ],
    metrics: [],
  })
}
function rule(patch: Partial<AutomationRule> = {}): AutomationRule {
  return AutomationRuleSchema.parse({
    id: "expiry",
    title: "Deadline",
    revision: 1,
    enabled: true,
    paused: false,
    condition: { type: "deadline" },
    action: { type: "move-section", columnId: "done" },
    ...patch,
  })
}
function apply(m: LinkedModel, plan: ReturnType<typeof planAutomation>) {
  return {
    ...m,
    cards: m.cards.map((c) => plan.cards.find((x) => x.id === c.id) ?? c),
    dashboards: m.dashboards.map(
      (b) => plan.dashboards.find((x) => x.id === b.id) ?? b
    ),
  }
}
describe("Goal Path", () => {
  it("keeps manual values across modes and counts only required stages", () => {
    const g = goal()
    expect(goalProgress(g)).toBe(0)
    g.steps[1].status = "completed"
    expect(goalProgress(g)).toBe(0)
    g.steps[0].status = "completed"
    expect(goalProgress(g)).toBe(100)
    g.progressMode = "manual"
    expect(goalProgress(g)).toBe(37)
    g.steps = []
    g.progressMode = "stages"
    expect(goalProgress(g)).toBeNull()
  })
  it.each([
    [0, 10, 5, "increase", 50],
    [10, 0, 5, "decrease", 50],
    [5, 5, 5, "increase", 100],
    [5, 5, 4, "increase", 0],
    [5, 5, 6, "decrease", 0],
    [0, 10, 99, "increase", 100],
    [0, 10, -1, "increase", 0],
  ] as const)(
    "metric %s → %s current %s %s",
    (start, target, current, direction, value) => {
      expect(
        metricProgress({
          id: "m",
          title: "Own metric",
          unit: "",
          start,
          target,
          current,
          direction,
        })
      ).toBe(value)
    }
  )
  it("calculates finite progress even at extreme numeric endpoints", () => {
    expect(
      metricProgress({
        id: "m",
        title: "Own",
        unit: "",
        start: -1e308,
        target: 1e308,
        current: 0,
        direction: "increase",
      })
    ).toBe(50)
  })
  it("never rounds an unfinished metric or required route to 100%", () => {
    expect(
      metricProgress({
        id: "m",
        title: "Own",
        unit: "",
        start: 0,
        target: 1000,
        current: 999,
        direction: "increase",
      })
    ).toBe(99)
    const g = goal()
    g.steps = Array.from({ length: 1000 }, (_, i) => ({
      id: `s-${i}`,
      required: true,
      status: i === 999 ? "not-started" : "completed",
    }))
    expect(goalProgress(g)).toBe(99)
  })
  it("rejects reversed metrics, duplicate IDs and skipping required steps", () => {
    const g = goal()
    expect(
      GoalPathSchema.safeParse({ ...g, steps: [...g.steps, g.steps[0]] })
        .success
    ).toBe(false)
    expect(
      GoalPathSchema.safeParse({
        ...g,
        steps: [{ ...g.steps[0], skipped: true }],
      }).success
    ).toBe(false)
    const metric: GoalMetric = {
      id: "m",
      title: "Own",
      unit: "",
      start: 10,
      target: 0,
      direction: "increase",
    }
    expect(GoalPathSchema.safeParse({ ...g, metrics: [metric] }).success).toBe(
      false
    )
  })
  it("supports revisits, optional steps, and explicit strict ordering", () => {
    const g = goal()
    g.steps[1].required = true
    expect(setGoalStep(g, "done", "completed").steps[1].status).toBe(
      "completed"
    )
    g.strictOrder = true
    expect(() => setGoalStep(g, "done", "in-progress")).toThrow()
    const finished = setGoalStep(
      setGoalStep(g, "todo", "completed"),
      "done",
      "completed"
    )
    expect(setGoalStep(finished, "todo", "in-progress").steps[0].status).toBe(
      "in-progress"
    )
  })
  it("records dated history without replacing current unless requested", () => {
    const g = goal()
    g.metrics = [
      {
        id: "m",
        title: "Own",
        unit: "",
        start: 0,
        target: 10,
        current: 8,
        direction: "increase",
      },
    ]
    const a = recordGoalMeasurement(g, "m", {
      id: "old",
      date: "2026-01-01",
      value: 1,
    })
    expect(a.metrics[0].current).toBe(8)
    const b = recordGoalMeasurement(
      a,
      "m",
      { id: "new", date: "2026-10-18", value: 9 },
      true
    )
    expect(b.metrics[0].current).toBe(9)
    expect(() =>
      recordGoalMeasurement(b, "m", { id: "old", date: "2026-01-01", value: 2 })
    ).toThrow()
    expect(goalProgress({ ...b, progressMode: "metric", metricId: "m" })).toBe(
      90
    )
  })
  it("exposes Goal progress through existing links with no cards required", () => {
    const m = model()
    m.cards = []
    m.dashboards[0].goalPath!.steps[0].status = "completed"
    expect(
      linkedProgress(m, {
        schemaVersion: 1,
        boardId: "board",
        mode: "progress",
        source: { type: "goal" },
        rules: [],
        requireFullCoverage: true,
      }).value
    ).toBe(100)
  })
})
describe("durable local rules", () => {
  it("does nothing by default", () => {
    expect(planAutomation(model(), now).events).toHaveLength(0)
  })
  it("executes expired deadline once, preserves axes and manual returns, and survives reload", () => {
    let m = model()
    m.cards[0].automationRules = [rule()]
    const p = reconcileAutomation(m, now, ["board"])
    expect(p.events).toHaveLength(1)
    expect(p.cards[0].columnId).toBe("done")
    expect(p.cards[0].stageId).toBe("todo")
    m = apply(m, p)
    m.cards[0].columnId = "todo"
    expect(
      reconcileAutomation(JSON.parse(JSON.stringify(m)), now + 100000, [
        "board",
      ]).events
    ).toHaveLength(0)
    m.cards[0].deadline = "2026-10-16"
    expect(planAutomation(m, now).events).toHaveLength(1)
  })
  it("date-only expires at local end of day, timed expires exactly", () => {
    const m = model()
    m.cards[0].automationRules = [rule()]
    m.cards[0].deadline = "2026-10-18"
    expect(
      planAutomation(m, new Date("2026-10-18T23:59:59.998").getTime()).events
    ).toHaveLength(0)
    expect(
      planAutomation(m, new Date("2026-10-18T23:59:59.999").getTime()).events
    ).toHaveLength(1)
    m.cards[0].deadline = "2026-10-18T12:00:00+03:00"
    expect(planAutomation(m, now - 1).events).toHaveLength(0)
    expect(planAutomation(m, now).events).toHaveLength(1)
  })
  it.each(["completed", "archived", "paused", "disabled", "deleted"])(
    "ignores %s unless allowed",
    (type) => {
      const m = model(),
        r = rule()
      m.cards[0].automationRules = [r]
      if (type === "completed") m.cards[0].columnId = "done"
      if (type === "archived") m.cards[0].archived = true
      if (type === "paused") r.paused = true
      if (type === "disabled") r.enabled = false
      if (type === "deleted") m.cards[0].deletedAt = 2
      const p = planAutomation(m, now)
      expect(p.events.some((e) => e.result === "applied")).toBe(false)
    }
  )
  it("requires a nonempty checklist, ignores code examples, re-arms after a new completion", () => {
    let m = model()
    m.cards[0].automationRules = [
      rule({
        condition: { type: "checklist-complete" },
        action: { type: "history", message: "Ready" },
      }),
    ]
    expect(planAutomation(m, now).events).toHaveLength(0)
    m.cards[0].body = "```md\n- [ ] Example\n```\n- [x] Actual"
    m = apply(m, planAutomation(m, now))
    expect(planAutomation(m, now).events).toHaveLength(0)
    m.cards[0].body = "- [ ] Actual"
    m = apply(m, planAutomation(m, now))
    m.cards[0].body = "- [x] Actual"
    expect(planAutomation(m, now).events).toHaveLength(1)
  })
  it("detects incompatible targets before any effect and consumes the conflict", () => {
    let m = model()
    m.cards[0].automationRules = [
      rule({ id: "a", action: { type: "set-progress", value: 25 } }),
      rule({ id: "b", action: { type: "set-progress", value: 75 } }),
    ]
    const p = planAutomation(m, now)
    expect(p.events.map((e) => e.result)).toEqual(["conflict", "conflict"])
    expect(p.cards[0].progress).toBeUndefined()
    m = apply(m, p)
    expect(planAutomation(m, now).events).toHaveLength(0)
  })
  it("reports missing target without losing card", () => {
    const m = model()
    m.cards[0].automationRules = [
      rule({ action: { type: "move-section", columnId: "gone" } }),
    ]
    const p = planAutomation(m, now)
    expect(p.events[0].result).toBe("missing-target")
    expect(p.cards[0].columnId).toBe("todo")
  })
  it("uses own Goal and metric conditions and explicit actions", () => {
    const m = model()
    m.dashboards[0].goalPath!.steps[0].status = "completed"
    m.cards[0].automationRules = [
      rule({
        condition: { type: "goal-complete" },
        action: { type: "set-progress", value: 100 },
      }),
    ]
    expect(planAutomation(m, now).cards[0].progress).toBe(100)
    const g = m.dashboards[0].goalPath!
    g.metrics = [
      {
        id: "metric",
        title: "Own",
        unit: "",
        start: 10,
        target: 0,
        current: 0,
        direction: "decrease",
      },
    ]
    m.cards[0].automationRules = [
      rule({
        condition: { type: "metric-target", metricId: "metric" },
        action: { type: "complete-goal-step", stepId: "done" },
      }),
    ]
    expect(planAutomation(m, now).dashboards[0].goalPath!.steps[1].status).toBe(
      "completed"
    )
  })
  it("rebases consumption after undo, but permits a later new condition", () => {
    let m = model()
    m.cards[0].progress = 100
    m.cards[0].automationRules = [
      rule({
        condition: { type: "progress-complete" },
        action: { type: "set-progress", value: 0 },
      }),
    ]
    m = apply(m, reconcileAutomation(m, now, ["board"]))
    m.cards[0].progress = 100
    m.cards = rebaseAutomationAfterUndo(m, now)
    expect(planAutomation(m, now).events).toHaveLength(0)
    m.cards[0].progress = 0
    m = apply(m, planAutomation(m, now))
    m.cards[0].progress = 100
    expect(planAutomation(m, now).events).toHaveLength(1)
  })
  it("rejects over 1000 effects before mutating the snapshot", () => {
    const m = model(),
      base = m.cards[0]
    m.cards = Array.from({ length: 1001 }, (_, i) => ({
      ...base,
      id: `limit-${i}`,
      automationRules: [
        rule({ action: { type: "history", message: "Event" } }),
      ],
    }))
    const saved = JSON.stringify(m)
    expect(() => planAutomation(m, now)).toThrow(/operation limit/)
    expect(JSON.stringify(m)).toBe(saved)
  })
  it("checks inclusive linked ranges once per entry and tolerates a deleted child", () => {
    let m = model()
    const childColumn = ColumnSchema.parse({
      ...m.columns[0],
      id: "child-column",
      dashboardId: "child",
    })
    m.columns.push(childColumn)
    m.dashboards.push(
      DashboardSchema.parse({
        ...m.dashboards[0],
        id: "child",
        goalPath: undefined,
        layout: initialLayout([childColumn], "free"),
      })
    )
    m.cards.push(
      CardSchema.parse({
        ...m.cards[0],
        id: "child-card",
        columnId: "child-column",
        progress: 49,
      })
    )
    m.cards[0].boardLink = {
      schemaVersion: 1,
      boardId: "child",
      mode: "progress",
      source: { type: "selected" },
      rules: [],
      requireFullCoverage: true,
    }
    m.cards[0].automationRules = [
      rule({
        condition: { type: "linked-range", min: 49, max: 50 },
        action: { type: "history", message: "Range" },
      }),
    ]
    m = apply(m, planAutomation(m, now))
    expect(m.cards[0].automationState?.[0].result).toBe("applied")
    m.cards[1].progress = 50
    expect(planAutomation(m, now).events).toHaveLength(0)
    m.cards[1].progress = 51
    m = apply(m, planAutomation(m, now))
    m.cards[1].progress = 49
    expect(planAutomation(m, now).events).toHaveLength(1)
    m.dashboards[1].deletedAt = 2
    expect(planAutomation(m, now).events).toHaveLength(0)
    expect(m.cards[0].id).toBe("card")
  })
  it("reserves existing linked-move targets and never oscillates with a conflicting new stage rule", () => {
    let m = model()
    m.columns.push({
      ...m.columns[0],
      id: "child-column",
      dashboardId: "child",
    })
    m.dashboards.push({
      ...m.dashboards[0],
      id: "child",
      goalPath: undefined,
      progress: 50,
      layout: initialLayout([m.columns[2]], "free"),
    })
    m.cards[0].boardLink = {
      schemaVersion: 1,
      boardId: "child",
      mode: "auto-move",
      source: { type: "manual" },
      rules: [{ min: 0, max: 100, stageId: "todo" }],
      requireFullCoverage: true,
    }
    m.cards[0].automationRules = [
      rule({ action: { type: "set-stage", stageId: "done" } }),
    ]
    const p = reconcileAutomation(m, now, ["board", "child"])
    expect(p.events[0].result).toBe("conflict")
    m = apply(m, p)
    expect(reconcileAutomation(m, now, ["board", "child"]).events).toHaveLength(
      0
    )
  })
  it("honors archived workspace/project context and an explicit opt-in", () => {
    const m = model()
    m.archivedBoardIds = ["board"]
    m.cards[0].automationRules = [
      rule({ action: { type: "history", message: "Event" } }),
    ]
    expect(planAutomation(m, now).events[0].result).toBe("skipped-archived")
    m.cards[0].automationRules[0].includeArchived = true
    expect(planAutomation(m, now).events[0].result).toBe("applied")
  })
  it("one nearest-deadline schedule ignores past and paused rules", () => {
    const m = model()
    m.cards[0].automationRules = [rule()]
    expect(nextAutomationDeadline(m.cards, now)).toBeNull()
    m.cards[0].deadline = "2026-10-20T12:00:00+03:00"
    expect(nextAutomationDeadline(m.cards, now)).toBeGreaterThan(now)
    m.cards[0].automationRules[0].paused = true
    expect(nextAutomationDeadline(m.cards, now)).toBeNull()
  })
})
