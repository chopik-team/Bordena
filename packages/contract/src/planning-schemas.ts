import { z } from "zod"
import { EntityIdSchema, DeadlineSchema } from "./value-schemas"

const percent = z.number().finite().min(0).max(100)
export const GoalMetricSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().min(1).max(256),
    start: z.number().finite(),
    target: z.number().finite(),
    current: z.number().finite().nullable().optional(),
    unit: z.string().max(64),
    direction: z.enum(["increase", "decrease"]),
    history: z
      .array(
        z
          .object({
            id: EntityIdSchema,
            date: DeadlineSchema,
            value: z.number().finite(),
          })
          .strict()
      )
      .max(10000)
      .optional(),
  })
  .strict()
  .refine(
    (m) =>
      m.direction === "increase" ? m.target >= m.start : m.target <= m.start,
    "Metric target contradicts its direction"
  )

export const GoalStepSchema = z
  .object({
    id: EntityIdSchema,
    status: z.enum(["not-started", "in-progress", "completed", "paused"]),
    required: z.boolean(),
    skipped: z.boolean().optional(),
  })
  .strict()
  .refine((s) => !s.skipped || !s.required, "Required steps cannot be skipped")

export const GoalPathSchema = z
  .object({
    schemaVersion: z.literal(1),
    description: z.string().max(10000).optional(),
    progressMode: z.enum(["manual", "stages", "metric"]),
    manualProgress: percent.nullable().optional(),
    strictOrder: z.boolean().optional(),
    steps: z.array(GoalStepSchema).max(1000),
    metrics: z.array(GoalMetricSchema).max(100),
    metricId: EntityIdSchema.optional(),
  })
  .strict()
  .superRefine((g, ctx) => {
    for (const values of [g.steps, g.metrics])
      if (new Set(values.map((x) => x.id)).size !== values.length)
        ctx.addIssue({ code: "custom", message: "Duplicate Goal ID" })
    if (g.metricId && !g.metrics.some((m) => m.id === g.metricId))
      ctx.addIssue({ code: "custom", message: "Goal metric is unavailable" })
    if (
      g.metrics.some(
        (m) =>
          new Set(m.history?.map((h) => h.id)).size !== (m.history?.length ?? 0)
      )
    )
      ctx.addIssue({ code: "custom", message: "Duplicate measurement ID" })
  })

export const AutomationConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("deadline") }).strict(),
  z.object({ type: z.literal("checklist-complete") }).strict(),
  z.object({ type: z.literal("progress-complete") }).strict(),
  z.object({ type: z.literal("goal-complete") }).strict(),
  z
    .object({ type: z.literal("metric-target"), metricId: EntityIdSchema })
    .strict(),
  z
    .object({ type: z.literal("linked-range"), min: percent, max: percent })
    .strict()
    .refine((r) => r.min <= r.max, "Reversed range"),
])
export const AutomationActionSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("move-section"), columnId: EntityIdSchema })
    .strict(),
  z.object({ type: z.literal("set-stage"), stageId: EntityIdSchema }).strict(),
  z.object({ type: z.literal("set-state"), stateId: EntityIdSchema }).strict(),
  z.object({ type: z.literal("set-progress"), value: percent }).strict(),
  z
    .object({ type: z.literal("complete-goal-step"), stepId: EntityIdSchema })
    .strict(),
  z
    .object({ type: z.literal("history"), message: z.string().max(1000) })
    .strict(),
])
export const AutomationRuleSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().min(1).max(256),
    revision: z.number().int().min(1),
    enabled: z.boolean(),
    paused: z.boolean(),
    includeCompleted: z.boolean().optional(),
    includeArchived: z.boolean().optional(),
    condition: AutomationConditionSchema,
    action: AutomationActionSchema,
  })
  .strict()
export const AutomationExecutionSchema = z
  .object({
    ruleId: EntityIdSchema,
    cardId: EntityIdSchema,
    signature: z.string().max(10000),
    satisfied: z.boolean(),
    generation: z.number().int().nonnegative(),
    eventKey: z.string().max(12000).optional(),
    at: z.number().finite(),
    result: z.enum([
      "armed",
      "applied",
      "no-op",
      "conflict",
      "missing-target",
      "skipped-complete",
      "skipped-archived",
      "undone",
    ]),
    reason: z.string().max(1000),
  })
  .strict()
export type GoalPath = z.infer<typeof GoalPathSchema>
export type GoalMetric = z.infer<typeof GoalMetricSchema>
export type AutomationRule = z.infer<typeof AutomationRuleSchema>
export type AutomationExecution = z.infer<typeof AutomationExecutionSchema>
