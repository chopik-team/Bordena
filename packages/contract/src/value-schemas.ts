import { z } from "zod"
export const EntityIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,128}$/)
  .refine((id) => !["__proto__", "prototype", "constructor"].includes(id))
export function validDeadline(value: string): boolean {
  const match =
    /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
      value
    )
  if (!match) return false
  const day = new Date(`${match[1]}T12:00:00Z`)
  return (
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === match[1] &&
    (match[2] === undefined ||
      (Number(match[2]) < 24 &&
        Number(match[3]) < 60 &&
        Number(match[4] ?? 0) < 60 &&
        Number.isFinite(Date.parse(value))))
  )
}
export const DeadlineSchema = z.string().max(64).refine(validDeadline)
