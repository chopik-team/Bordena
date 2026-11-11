import { describe, expect, it } from "vitest"
import { calendarDefaults, planningCalendarId } from "./calendar-data"
import { generalCalendar } from "@bordena/contract"

describe("planning calendar precedence", () => {
  it("chooses explicit block, card, board, then general without changing the inputs", () => {
    const calendars = [
      generalCalendar(),
      ...["block", "card", "board"].map((id) => ({
        ...calendarDefaults(id),
        id,
      })),
    ]
    const card = { calendarId: "card" },
      board = { defaultCalendarId: "board" },
      original = structuredClone(calendars)
    expect(planningCalendarId(calendars, card, board, "block")).toBe("block")
    expect(planningCalendarId(calendars, card, board)).toBe("card")
    expect(planningCalendarId(calendars, {}, board)).toBe("board")
    expect(
      planningCalendarId(calendars, { calendarId: generalCalendar().id }, board)
    ).toBe(generalCalendar().id)
    expect(planningCalendarId(calendars)).toBe(generalCalendar().id)
    expect(calendars).toEqual(original)
  })
  it("falls through unavailable targets without manufacturing a replacement calendar", () => {
    const calendars = [
      generalCalendar(),
      { ...calendarDefaults("Deleted"), id: "gone", deletedAt: 1 },
    ]
    expect(
      planningCalendarId(
        calendars,
        { calendarId: "gone" },
        { defaultCalendarId: "missing" },
        "gone"
      )
    ).toBe(generalCalendar().id)
    expect(calendars).toHaveLength(2)
  })
})
