import { describe, expect, it } from "vitest"
import type { CalendarEvent, AvailabilityProfile } from "@bordena/contract"
import {
  calendarYearStats,
  hasPlannedWork,
  mergeCalendarIntervals,
  shiftCalendarPeriod,
  type YearItem,
} from "../src/calendar-year"
import { calendarOccurrences, zonedInstant } from "../src/calendar"
const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e",
  calendarId: "cal",
  title: "Work",
  description: "Preserved",
  kind: "block",
  start: "2026-01-01T10:00:00Z",
  end: "2026-01-01T12:00:00Z",
  allDay: false,
  timeZone: "UTC",
  status: "planned",
  links: [{ type: "card", id: "card" }],
  priority: "medium",
  flexible: false,
  pinned: false,
  syncCompletion: false,
  allowArchived: false,
  updatedAt: 1,
  deletedAt: null,
  ...patch,
})
const item = (e: CalendarEvent): YearItem => ({
  key: e.id,
  start: Date.parse(e.start),
  end: Date.parse(e.end),
  event: e,
})
describe("year planning calculations", () => {
  it("returns 12 genuine zero months for an empty year and no fabricated percentages", () => {
    const v = calendarYearStats(2026, "UTC", [])
    expect(v).toHaveLength(12)
    expect(
      v.every(
        (m) => m.busyHours === 0 && m.eventCount === 0 && m.percent === null
      )
    ).toBe(true)
  })
  it("merges overlaps without modifying inputs, keeps sums separate and deduplicates occurrences", () => {
    const a = item(event()),
      b = item(
        event({
          id: "b",
          start: "2026-01-01T11:00:00Z",
          end: "2026-01-01T13:00:00Z",
        })
      )
    const before = structuredClone([a, b])
    const m = calendarYearStats(2026, "UTC", [a, b, a])[0]
    expect(m).toMatchObject({ busyHours: 3, plannedHours: 4, eventCount: 2 })
    expect([a, b]).toEqual(before)
    expect(
      mergeCalendarIntervals([
        { start: 0, end: 1 },
        { start: 1, end: 3 },
        { start: 8, end: 9 },
      ])
    ).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 9 },
    ])
  })
  it("clips a multi-day interval at local month boundaries", () => {
    const v = calendarYearStats(2026, "Europe/Moscow", [
      item(
        event({ start: "2026-01-31T20:00:00Z", end: "2026-02-01T02:00:00Z" })
      ),
    ])
    expect(v[0].busyHours).toBe(1)
    expect(v[1].busyHours).toBe(5)
  })
  it("excludes cancelled/deleted/all-day hours and counts unique card deadlines separately", () => {
    const a = item(event({ allDay: true })),
      b = item(event({ id: "cancelled", status: "cancelled" })),
      c = item(event({ id: "deleted", deletedAt: 5 }))
    const deadline = { ...item(event({ id: "deadline" })), deadline: true }
    const duplicate = { ...deadline, key: "mirror" }
    const m = calendarYearStats(2026, "UTC", [a, b, c, deadline, duplicate])[0]
    expect(m).toMatchObject({
      busyHours: 0,
      plannedHours: 0,
      eventCount: 1,
      deadlineCount: 1,
    })
  })
  it("expands recurring exceptions only in the bounded selected year", () => {
    const e = event({
      recurrence: { frequency: "daily", interval: 1, count: 3 },
      exceptions: { "2026-01-02": null },
    })
    const occurrences = calendarOccurrences(
      e,
      Date.parse("2026-01-01"),
      Date.parse("2027-01-01")
    )
    expect(calendarYearStats(2026, "UTC", occurrences)[0]).toMatchObject({
      busyHours: 4,
      eventCount: 2,
    })
  })
  it("measures DST elapsed time instead of wall-clock differences", () => {
    const e = event({
      start: "2026-10-25T02:00:00+02:00",
      end: "2026-10-25T03:00:00+01:00",
      timeZone: "Europe/Berlin",
    })
    expect(
      calendarYearStats(2026, "Europe/Berlin", [item(e)])[9].busyHours
    ).toBe(2)
  })
  it("intersects busy time with normalized availability, with no division by zero", () => {
    const profile: AvailabilityProfile = {
      id: "p",
      title: "Work",
      color: "#000000",
      weekdays: [],
      dates: ["2026-01-01"],
      excludedDates: [],
      intervals: [
        { start: 600, end: 720 },
        { start: 660, end: 780 },
      ],
      breaks: [],
      updatedAt: 1,
    }
    const v = calendarYearStats(
      2026,
      "UTC",
      [
        item(
          event({ start: "2026-01-01T09:00:00Z", end: "2026-01-01T11:00:00Z" })
        ),
      ],
      profile
    )
    expect(v[0].availableHours).toBe(3)
    expect(v[0].percent).toBeCloseTo(100 / 3)
    expect(v[1].percent).toBeNull()
  })
  it("does not count a midnight end twice in the following month", () => {
    const v = calendarYearStats(2026, "UTC", [
      item(
        event({ start: "2026-01-31T23:00:00Z", end: "2026-02-01T00:00:00Z" })
      ),
    ])
    expect(v[0].busyHours).toBe(1)
    expect(v[1].eventCount).toBe(0)
  })
  it("keeps month/year arrows exact around leap dates and agenda periods explicit", () => {
    expect(shiftCalendarPeriod("2026-01-31", "month", 1)).toBe("2026-02-01")
    expect(shiftCalendarPeriod("2024-02-29", "year", 1)).toBe("2025-02-01")
    expect(shiftCalendarPeriod("2026-01-01", "agenda", 1)).toBe("2026-04-01")
    expect(zonedInstant("2026-03-29T02:30", "Europe/Berlin")).toBeNull()
  })
  it("keeps a task planned while other recurrence occurrences remain", () => {
    expect(
      hasPlannedWork(
        event({
          recurrence: { frequency: "daily", interval: 1, count: 1 },
          exceptions: { "2026-01-01": { status: "completed" } },
        })
      )
    ).toBe(false)
    expect(
      hasPlannedWork(
        event({
          status: "completed",
          recurrence: { frequency: "daily", interval: 1, count: 1 },
          exceptions: { "2026-01-01": { status: "planned" } },
        })
      )
    ).toBe(true)
    expect(
      hasPlannedWork(
        event({
          recurrence: { frequency: "daily", interval: 1, count: 2 },
          exceptions: { "2026-01-01": null },
        })
      )
    ).toBe(true)
    expect(
      hasPlannedWork(
        event({
          recurrence: { frequency: "daily", interval: 1, count: 1 },
          exceptions: { "2026-01-01": null },
        })
      )
    ).toBe(false)
    expect(
      hasPlannedWork(
        event({
          recurrence: { frequency: "daily", interval: 1, until: "2026-01-01" },
          exceptions: { "2026-01-01": null },
        })
      )
    ).toBe(false)
  })
})
