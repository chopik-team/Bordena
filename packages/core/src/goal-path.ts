import {
  GoalPathSchema,
  type GoalMetric,
  type GoalPath,
} from "@bordena/contract"
import type { Dashboard } from "./types"

export function metricProgress(metric: GoalMetric): number | null {
  if (metric.current == null) return null
  const increasing = metric.direction === "increase"
  if (
    increasing
      ? metric.current >= metric.target
      : metric.current <= metric.target
  )
    return 100
  if (metric.start === metric.target) return 0
  if (
    increasing ? metric.current <= metric.start : metric.current >= metric.start
  )
    return 0
  // Scale before subtraction so even finite values near Number.MAX_VALUE stay finite.
  const scale = Math.max(
    1,
    Math.abs(metric.start),
    Math.abs(metric.target),
    Math.abs(metric.current)
  )
  const fraction =
    (metric.current / scale - metric.start / scale) /
    (metric.target / scale - metric.start / scale)
  return Math.max(0, Math.min(99, Math.round(fraction * 100)))
}
export function goalProgress(goal?: GoalPath): number | null {
  if (!goal) return null
  if (goal.progressMode === "manual") return goal.manualProgress ?? null
  if (goal.progressMode === "metric") {
    const metric = goal.metrics.find((m) => m.id === goal.metricId)
    return metric ? metricProgress(metric) : null
  }
  const required = goal.steps.filter((s) => s.required)
  if (!required.length) return null
  const done = required.filter((s) => s.status === "completed").length
  return done === required.length
    ? 100
    : Math.min(99, Math.round((done / required.length) * 100))
}
export function validateGoal(board: Dashboard): void {
  if (!board.goalPath) return
  const goal = GoalPathSchema.parse(board.goalPath)
  if (goal.steps.some((s) => !board.layout?.stages.some((a) => a.id === s.id)))
    throw new Error("Goal step is outside the board's stages")
}
export function setGoalStep(
  goal: GoalPath,
  id: string,
  status: GoalPath["steps"][number]["status"]
): GoalPath {
  const index = goal.steps.findIndex((s) => s.id === id)
  if (index < 0) throw new Error("Goal step is unavailable")
  if (
    goal.strictOrder &&
    ["in-progress", "completed"].includes(status) &&
    goal.steps
      .slice(0, index)
      .some((s) => s.required && s.status !== "completed")
  )
    throw new Error("Complete earlier required steps first")
  return {
    ...goal,
    steps: goal.steps.map((s) =>
      s.id === id ? { ...s, status, skipped: false } : s
    ),
  }
}

/** Recording an old measurement never silently overwrites the current value. */
export function recordGoalMeasurement(
  goal: GoalPath,
  metricId: string,
  measurement: { id: string; date: string; value: number },
  makeCurrent = false
): GoalPath {
  if (!goal.metrics.some((m) => m.id === metricId))
    throw new Error("Goal metric is unavailable")
  return GoalPathSchema.parse({
    ...goal,
    metrics: goal.metrics.map((m) => {
      if (m.id !== metricId) return m
      if (m.history?.some((h) => h.id === measurement.id))
        throw new Error("Measurement ID already exists")
      return {
        ...m,
        current: makeCurrent ? measurement.value : m.current,
        history: [...(m.history ?? []), measurement].sort(
          (a, b) =>
            new Date(
              a.date.length === 10 ? `${a.date}T12:00:00` : a.date
            ).getTime() -
              new Date(
                b.date.length === 10 ? `${b.date}T12:00:00` : b.date
              ).getTime() || a.id.localeCompare(b.id)
        ),
      }
    }),
  })
}
