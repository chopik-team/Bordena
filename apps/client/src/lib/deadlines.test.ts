import { describe, it, expect } from "vitest"
import { deadlineInstant, isCardOverdue, deadlineRemaining } from "./deadlines"
import { initialLayout } from "@bordena/core"
import { deadlineLocalParts, localDeadline } from "@bordena/ui-kit"
describe("local deadlines", () => {
  it("validates calendar edits and keeps local date/time stable across offset roundtrips", () => {
    expect(localDeadline("2026-02-31")).toBeNull()
    expect(localDeadline("2026-10-18", "25:00")).toBeNull()
    expect(localDeadline("2026-10-18")).toBe("2026-10-18")
    const value = localDeadline("2026-10-18", "00:00")!
    expect(value).toMatch(/T00:00:00[+-]\d{2}:\d{2}$/)
    expect(deadlineLocalParts(value)).toEqual({
      date: "2026-10-18",
      time: "00:00",
    })
    if (
      Intl.DateTimeFormat().resolvedOptions().timeZone === "America/New_York"
    ) {
      expect(localDeadline("2026-03-08", "02:30")).toBeNull()
      expect(localDeadline("2026-07-18", "17:00")).toContain("-04:00")
      expect(localDeadline("2026-12-18", "17:00")).toContain("-05:00")
    }
  })
  const card = { deadline: "2026-12-19", deletedAt: null }
  it("expires a date-only task at the end of its local day", () => {
    expect(
      isCardOverdue(card, undefined, new Date("2026-12-19T17:40:00").getTime())
    ).toBe(false)
    expect(
      isCardOverdue(card, undefined, new Date("2026-12-20T00:00:00").getTime())
    ).toBe(true)
  })
  it("uses the explicit timezone when provided and supports exact local time", () => {
    const now = Date.parse("2026-12-19T14:40:00Z")
    expect(deadlineInstant("2026-12-19T17:40:00+03:00")).toBe(now)
    expect(
      isCardOverdue(
        { ...card, deadline: "2026-12-19T17:40:00+03:00" },
        undefined,
        now + 1
      )
    ).toBe(true)
    expect(deadlineRemaining("2026-12-19T17:40:00+03:00", now - 1000)).toBe(
      1000
    )
  })
  it("does not mark completed, deleted or undated cards overdue", () => {
    const now = Date.parse("2027-01-01")
    expect(isCardOverdue(card, { done: true }, now)).toBe(false)
    expect(isCardOverdue({ ...card, deadline: null }, undefined, now)).toBe(
      false
    )
    expect(isCardOverdue({ ...card, deletedAt: 1 }, undefined, now)).toBe(false)
    expect(deadlineRemaining("invalid", now)).toBeNull()
  })
  it("honors explicit completion states by ID, preserves frozen deadlines and supports reopening", () => {
    const layout = initialLayout([], "matrix")
    layout.states.push(
      { id: "closed", title: "Переименованное", done: true },
      { id: "frozen", title: "Заморожено", done: false }
    )
    const dated = { ...card, columnId: "a", stateId: "closed" }
    const now = new Date("2027-01-01T12:00").getTime()
    expect(isCardOverdue(dated, { done: false }, now, layout)).toBe(false)
    expect(
      isCardOverdue(
        { ...dated, stateId: "frozen" },
        { done: true },
        now,
        layout
      )
    ).toBe(true)
    expect(
      isCardOverdue(
        { ...dated, stateId: undefined },
        { done: true },
        now,
        layout
      )
    ).toBe(false)
  })
})
