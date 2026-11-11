import { z } from "zod"

const axis = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  title: z.string().max(4096),
  color: z.string().max(32).optional(),
  collapsed: z.boolean().optional(),
  /** Explicit state completion; absent retains legacy section-based completion. */
  done: z.boolean().optional(),
})
export const BoardLayoutSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(["free", "matrix"]),
  lanes: z.array(axis).min(1).max(1000),
  stages: z.array(axis).min(1).max(1000),
  states: z.array(axis).min(1).max(1000),
  sections: z
    .record(
      z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
      z.object({
        laneId: z.string().max(128),
        stageId: z.string().max(128),
        stateId: z.string().max(128),
        collapsed: z.boolean().optional(),
        position: z.string().max(256).optional(),
        progressMode: z.enum(["off", "manual", "position"]).optional(),
      })
    )
    .refine((v) => Object.keys(v).length <= 50000),
  tint: z.boolean().optional(),
})
