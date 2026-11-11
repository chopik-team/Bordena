import { describe, expect, it } from "vitest"
import { calendarEventOnDate } from "./calendar-event-date"
import { wallTime } from "@bordena/core"
import type { CalendarEvent } from "@bordena/contract"
const event: CalendarEvent = {
  id: "event",
  calendarId: "cal",
  title: "Work",
  description: "Keep",
  kind: "block",
  start: "2026-03-28T10:00:00+01:00",
  end: "2026-03-28T12:00:00+01:00",
  allDay: false,
  timeZone: "Europe/Berlin",
  status: "planned",
  links: [{ type: "card", id: "card" }],
  priority: "high",
  flexible: false,
  pinned: false,
  syncCompletion: false,
  allowArchived: false,
  updatedAt: 1,
  deletedAt: null,
}
describe("move a work block to another local day", () => {
  it("moves legacy zoned timestamps in the device display zone without rewriting the stored zone", () => {
    const moved = calendarEventOnDate(event, "2027-01-02", "America/New_York")
    expect(wallTime(moved.start, "America/New_York")).toBe("2027-01-02T05:00")
    expect(moved.timeZone).toBe(event.timeZone)
    expect(Date.parse(moved.end) - Date.parse(moved.start)).toBe(7200000)
  })
  it("retains clock time and elapsed duration over DST without rewriting fields or links", () => {
    const before = structuredClone(event),
      moved = calendarEventOnDate(event, "2026-03-29")
    expect(wallTime(moved.start, event.timeZone)).toBe("2026-03-29T10:00")
    expect(Date.parse(moved.end) - Date.parse(moved.start)).toBe(7200000)
    expect({ ...moved, start: event.start, end: event.end }).toEqual(event)
    expect(event).toEqual(before)
  })
  it("rejects a nonexistent local clock time", () => {
    expect(() =>
      calendarEventOnDate(
        { ...event, start: "2026-03-28T02:30:00+01:00" },
        "2026-03-29"
      )
    ).toThrow()
  })
  it("retains all-day calendar span rather than assuming 24 hours", () => {
    const moved = calendarEventOnDate(
      {
        ...event,
        allDay: true,
        start: "2026-03-28T00:00:00+01:00",
        end: "2026-03-29T00:00:00+01:00",
      },
      "2026-03-29"
    )
    expect(wallTime(moved.end, event.timeZone)).toBe("2026-03-30T00:00")
    expect(Date.parse(moved.end) - Date.parse(moved.start)).toBe(23 * 3600000)
  })
})
