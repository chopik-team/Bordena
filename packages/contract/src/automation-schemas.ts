import { z } from "zod"
import { BoardLayoutSchema } from "./layout-schemas"

import { EntityIdSchema } from "./value-schemas"
import { GoalPathSchema, AutomationRuleSchema } from "./planning-schemas"
export { EntityIdSchema, DeadlineSchema, validDeadline } from "./value-schemas"
const percent = z.number().finite().min(0).max(100)
export const BoardLinkSchema = z
  .object({
    schemaVersion: z.literal(1),
    boardId: EntityIdSchema,
    mode: z.enum(["navigation", "progress", "auto-move"]),
    source: z
      .object({
        type: z.enum(["manual", "tasks", "stages", "selected", "goal"]),
        cardIds: z.array(EntityIdSchema).max(50000).optional(),
        sectionIds: z.array(EntityIdSchema).max(1000).optional(),
        completedColumnIds: z.array(EntityIdSchema).max(1000).optional(),
        completedStateIds: z.array(EntityIdSchema).max(1000).optional(),
        stageValues: z
          .array(z.object({ id: EntityIdSchema, value: percent }).strict())
          .max(1000)
          .optional(),
      })
      .strict(),
    requireFullCoverage: z.boolean().default(true),
    rules: z
      .array(
        z
          .object({
            min: percent.int(),
            max: percent.int(),
            stageId: EntityIdSchema,
            columnId: EntityIdSchema.optional(),
          })
          .strict()
      )
      .max(100)
      .default([]),
  })
  .strict()
export const FieldDefinitionSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().min(1).max(256),
    type: z.enum(["text", "number", "date", "percent", "checkbox", "select"]),
    options: z.array(z.string().min(1).max(256)).max(100).optional(),
  })
  .strict()
export const MirrorSchema = z
  .object({
    id: EntityIdSchema,
    sourceCardId: EntityIdSchema,
    columnId: EntityIdSchema,
    position: z.string().max(256),
    stageId: EntityIdSchema.optional(),
    stateId: EntityIdSchema.optional(),
  })
  .strict()
export const ExternalFileSchema = z
  .object({
    id: EntityIdSchema,
    name: z.string().min(1).max(4096),
    path: z
      .string()
      .min(1)
      .max(32768)
      .refine(
        (path) =>
          /^[A-Za-z]:[\\/]/.test(path) &&
          !path.includes("\0") &&
          !path.slice(2).includes(":") &&
          !path.split(/[\\/]/).includes("..")
      ),
    size: z.number().int().nonnegative(),
    mime: z.string().max(256),
    pinned: z.boolean().optional(),
    group: z.string().max(256).optional(),
  })
  .strict()
export const BoardTemplateSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().min(1).max(256),
    category: z.string().max(128),
    mode: z.enum(["free", "matrix"]),
    sections: z
      .array(
        z
          .object({
            sourceId: EntityIdSchema.optional(),
            title: z.string().max(4096),
            color: z.string().max(32),
            done: z.boolean(),
            progressMode: z.enum(["off", "manual", "position"]),
          })
          .strict()
      )
      .min(1)
      .max(1000),
    layout: BoardLayoutSchema.optional(),
    goalPath: GoalPathSchema.optional(),
    fields: z.array(FieldDefinitionSchema).max(100).default([]),
    examples: z
      .array(
        z
          .object({
            title: z.string().max(4096),
            body: z.string().max(100000),
            section: z.number().int().nonnegative(),
            automationRules: z.array(AutomationRuleSchema).max(100).optional(),
          })
          .strict()
      )
      .max(1000)
      .default([]),
  })
  .strict()
