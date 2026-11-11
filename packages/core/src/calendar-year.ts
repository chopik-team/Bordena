import type { AvailabilityProfile, CalendarEvent } from "@bordena/contract"
import {
  availabilityWindows,
  calendarDayShift,
  calendarOccurrences,
  wallTime,
  zonedInstant,
} from "./calendar"

export type CalendarViewName = "day" | "week" | "month" | "agenda" | "year"
export function shiftCalendarPeriod(
  day: string,
  view: CalendarViewName,
  direction: number
): string {
  if (view === "month" || view === "year") {
    const d = new Date(day + "T12:00Z")
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + direction * (view === "year" ? 12 : 1))
    return d.toISOString().slice(0, 10)
  }
  return calendarDayShift(
    day,
    direction * (view === "day" ? 1 : view === "agenda" ? 90 : 7)
  )
}
export interface YearItem {
  key: string
  start: number
  end: number
  event: CalendarEvent
  deadline?: boolean
  marker?: string
}
type Span = { start: number; end: number }
export function mergeCalendarIntervals(input: readonly Span[]): Span[] {
  const sorted = input
    .filter((v) => v.end > v.start)
    .map((v) => ({ ...v }))
    .sort((a, b) => a.start - b.start)
  const result: Span[] = []
  for (const v of sorted) {
    const last = result.at(-1)
    if (last && v.start <= last.end) last.end = Math.max(last.end, v.end)
    else result.push(v)
  }
  return result
}
const hours = (spans: Span[]) =>
  spans.reduce((n, v) => n + v.end - v.start, 0) / 3600000
export function calendarYearStats(
  year: number,
  zone: string,
  items: readonly YearItem[],
  profile?: AvailabilityProfile
) {
  const unique = [...new Map(items.map((i) => [i.key, i])).values()].filter(
    (i) => !i.event.deletedAt && i.event.status !== "cancelled"
  )
  return Array.from({ length: 12 }, (_, month) => {
    const day = `${year}-${String(month + 1).padStart(2, "0")}-01`
    const next =
      month === 11
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 2).padStart(2, "0")}-01`
    const start = zonedInstant(day + "T00:00", zone)!,
      end = zonedInstant(next + "T00:00", zone)!
    const inMonth = unique.filter((i) => i.start < end && i.end > start)
    const spans = inMonth
      .filter((i) => !i.deadline && !i.event.allDay)
      .map((i) => ({
        start: Math.max(start, i.start),
        end: Math.min(end, i.end),
      }))
    const busy = mergeCalendarIntervals(spans)
    const available: Span[] = []
    if (profile)
      for (let d = day; d < next; d = calendarDayShift(d, 1))
        available.push(...availabilityWindows(profile, d, zone))
    const windows = mergeCalendarIntervals(available)
    const availableHours = hours(windows)
    const occupiedAvailableHours = hours(
      mergeCalendarIntervals(
        busy.flatMap((b) =>
          windows.map((w) => ({
            start: Math.max(b.start, w.start),
            end: Math.min(b.end, w.end),
          }))
        )
      )
    )
    return {
      month,
      day,
      busyHours: hours(busy),
      plannedHours: hours(spans),
      eventCount: inMonth.filter((i) => !i.deadline).length,
      deadlineCount: new Set(
        inMonth
          .filter(
            (i) =>
              i.deadline &&
              !i.marker &&
              i.event.links.some((l) => l.type === "card")
          )
          .map((i) => i.event.links.find((l) => l.type === "card")!.id)
      ).size,
      availableHours,
      percent:
        profile && availableHours > 0
          ? (occupiedAvailableHours / availableHours) * 100
          : null,
    }
  })
}
/** Finite recurrence exceptions must not keep a task planned after its last block is removed. */
export function hasPlannedWork(event: CalendarEvent): boolean {
  if (event.deletedAt || event.kind !== "block" || event.status === "cancelled")
    return false
  if (event.status === "completed")
    return (
      !!event.recurrence &&
      Object.values(event.exceptions ?? {}).some((v) => v?.status === "planned")
    )
  if (!event.recurrence) return true
  const cancelled = Object.values(event.exceptions ?? {}).filter(
    (v) => !v || v.status === "cancelled" || v.status === "completed"
  ).length
  if (!cancelled) return true
  if (event.recurrence.count && cancelled >= event.recurrence.count)
    return false
  if (!event.recurrence.until && !event.recurrence.count) return true
  let day = wallTime(event.start, event.timeZone).slice(0, 10)
  const last = event.recurrence.until
  // Stop as soon as an active occurrence is found. Each window is bounded, using the shared engine.
  for (let windows = 0; windows < 10000; windows++) {
    const next = calendarDayShift(day, 399),
      from = zonedInstant(day + "T00:00", event.timeZone)!,
      to = zonedInstant(next + "T00:00", event.timeZone)!
    if (
      calendarOccurrences(event, from, to).some(
        (o) => o.event.status === "planned"
      )
    )
      return true
    if (last && next > last) return false
    if (event.recurrence.count && windows > cancelled + 1) return true
    day = next
  }
  return true
}
