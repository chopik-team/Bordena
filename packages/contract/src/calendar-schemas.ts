import { z } from "zod"
import { EntityIdSchema as id } from "./value-schemas"

const text = z.string().max(4096)
const day = z.iso.date()
const instant = z.iso
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)))
const zone = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v })
      return true
    } catch {
      return false
    }
  })
export const ScheduleLinkSchema = z
  .object({
    type: z.enum([
      "workspace",
      "project",
      "board",
      "section",
      "stage",
      "card",
      "checklist",
      "goal",
      "goal-step",
      "inline-date",
      "event",
    ]),
    id,
    boardId: id.optional(),
    cardId: id.optional(),
  })
  .strict()
export const RecurrenceSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    monthDay: z.number().int().min(1).max(31).optional(),
    until: day.optional(),
    count: z.number().int().min(1).max(100000).optional(),
  })
  .strict()
const reschedule = z.enum(["manual", "next-day", "smart"])
export const CalendarSchema = z
  .object({
    id,
    title: text.min(1),
    description: text,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    workspaceId: id.optional(),
    sourceBoardIds: z.array(id).max(1000),
    visible: z.boolean(),
    favorite: z.boolean(),
    order: z.number().int(),
    reschedule,
    profileId: id.optional(),
    horizon: z.number().int().min(1).max(90),
    showDeadlines: z.boolean(),
    deletedAt: z.number().nullable(),
    updatedAt: z.number(),
  })
  .strict()
const eventPatch = z
  .object({
    title: text.optional(),
    start: instant.optional(),
    end: instant.optional(),
    status: z.enum(["planned", "completed", "cancelled"]).optional(),
  })
  .strict()
  .refine(
    (p) => !p.start || !p.end || Date.parse(p.end) > Date.parse(p.start),
    "Instance end must follow start"
  )
export const CalendarEventSchema = z
  .object({
    id,
    calendarId: id,
    title: text.min(1),
    description: text,
    kind: z.enum(["event", "block"]),
    start: instant,
    end: instant,
    allDay: z.boolean(),
    timeZone: zone,
    status: z.enum(["planned", "completed", "cancelled"]),
    links: z.array(ScheduleLinkSchema).max(100),
    priority: z.enum(["low", "medium", "high"]),
    flexible: z.boolean(),
    pinned: z.boolean(),
    reschedule: reschedule.optional(),
    syncCompletion: z.boolean(),
    allowArchived: z.boolean(),
    recurrence: RecurrenceSchema.optional(),
    exceptions: z.record(day, eventPatch.nullable()).optional(),
    reminderMinutes: z.number().int().min(0).max(525600).optional(),
    execution: z
      .object({
        key: z.string().max(512),
        result: z.enum(["moved", "needs-planning", "completed"]),
        reason: text,
        at: z.number(),
      })
      .strict()
      .optional(),
    deletedAt: z.number().nullable(),
    updatedAt: z.number(),
  })
  .strict()
  .refine(
    (e) => Date.parse(e.end) > Date.parse(e.start),
    "End must follow start"
  )
export const AvailabilityProfileSchema = z
  .object({
    id,
    title: text.min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    dates: z.array(day).max(1000),
    excludedDates: z.array(day).max(1000),
    intervals: z
      .array(
        z
          .object({
            start: z.number().int().min(0).max(1439),
            end: z.number().int().min(1).max(2880),
          })
          .strict()
          .refine((v) => v.end > v.start)
      )
      .max(100),
    breaks: z
      .array(
        z
          .object({
            start: z.number().int().min(0).max(1439),
            end: z.number().int().min(1).max(2880),
          })
          .strict()
          .refine((v) => v.end > v.start)
      )
      .max(100),
    updatedAt: z.number(),
  })
  .strict()
export const CalendarStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: z.number(),
    calendars: z.array(CalendarSchema).max(1000),
    events: z.array(CalendarEventSchema).max(50000),
    profiles: z.array(AvailabilityProfileSchema).max(1000),
  })
  .strict()
  .superRefine((state, ctx) => {
    const general = state.calendars.find((c) => c.id === GENERAL_CALENDAR_ID)
    if (
      general &&
      (general.deletedAt !== null ||
        !general.visible ||
        !general.showDeadlines ||
        general.workspaceId ||
        general.sourceBoardIds.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "The general calendar always includes all tasks",
      })
    const ids = new Set<string>()
    for (const value of [
      ...state.calendars,
      ...state.events,
      ...state.profiles,
    ]) {
      if (ids.has(value.id))
        ctx.addIssue({ code: "custom", message: "Duplicate calendar ID" })
      ids.add(value.id)
    }
    for (const event of state.events)
      if (!state.calendars.some((c) => c.id === event.calendarId))
        ctx.addIssue({ code: "custom", message: "Calendar is unavailable" })
    for (const calendar of state.calendars)
      if (
        calendar.profileId &&
        !state.profiles.some((p) => p.id === calendar.profileId)
      )
        ctx.addIssue({
          code: "custom",
          message: "Availability profile is unavailable",
        })
  })
export type ScheduleLink = z.infer<typeof ScheduleLinkSchema>
export type BordenaCalendar = z.infer<typeof CalendarSchema>
export type CalendarEvent = z.infer<typeof CalendarEventSchema>
export type AvailabilityProfile = z.infer<typeof AvailabilityProfileSchema>
export type CalendarState = z.infer<typeof CalendarStateSchema>
export const GENERAL_CALENDAR_ID = "bordena-general-calendar"
/** A real destination for standalone events; tasks are derived, never copied. */
export const generalCalendar = (): BordenaCalendar => ({
  id: GENERAL_CALENDAR_ID,
  title: "Общий календарь",
  description: "",
  color: "#7866d5",
  sourceBoardIds: [],
  visible: true,
  favorite: true,
  order: -1,
  reschedule: "manual",
  horizon: 14,
  showDeadlines: true,
  updatedAt: 0,
  deletedAt: null,
})
export const emptyCalendarState = (): CalendarState => ({
  schemaVersion: 1,
  updatedAt: 0,
  calendars: [],
  events: [],
  profiles: [],
})
