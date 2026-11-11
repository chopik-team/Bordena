import { describe, expect, it, beforeAll, afterAll, vi } from "vitest"
beforeAll(()=>vi.stubEnv("TZ","UTC"))
afterAll(()=>vi.unstubAllEnvs())
import {
  CalendarSchema,
  CalendarEventSchema,
  CalendarStateSchema,
  emptyCalendarState,
  CardSchema,
  ColumnSchema,
  DashboardSchema,
  type CalendarEvent,
  type AvailabilityProfile,
  generalCalendar,
} from "@bordena/contract"
import {
  calendarOccurrences,
  layoutIntervals,
  zonedInstant,
  wallTime,
  availabilityWindows,
  planCalendar,
  findScheduleSlot,
  calendarSource,
  validateCalendarLinks,
  nextCalendarDeadline,
  type CalendarSources,
  cardInCalendar,
} from "../src/calendar"
describe("calendar membership", () => {
  const board = { id: "board", workspaceId: "space" }
  it("always derives general membership without copying or assigning cards", () => {
    const card = { calendarId: "custom" }
    expect(cardInCalendar(card, board, generalCalendar())).toBe(true)
    expect(card.calendarId).toBe("custom")
    expect(cardInCalendar({}, board, generalCalendar())).toBe(true)
  })
  it("does not fill an unconfigured custom calendar with unrelated cards", () => {
    expect(cardInCalendar({}, board, calendar())).toBe(false)
    expect(cardInCalendar({ calendarId: "cal" }, board, calendar())).toBe(true)
  })
  it("keeps optional board and workspace source scopes", () => {
    expect(
      cardInCalendar({}, board, { ...calendar(), workspaceId: "space" })
    ).toBe(true)
    expect(
      cardInCalendar({}, board, { ...calendar(), sourceBoardIds: ["other"] })
    ).toBe(false)
    expect(
      cardInCalendar({}, board, {
        ...calendar(),
        workspaceId: "space",
        sourceBoardIds: ["board"],
      })
    ).toBe(true)
  })
  it("does not resolve a deleted calendar by a stale assignment", () => {
    expect(
      cardInCalendar({ calendarId: "cal" }, board, {
        ...calendar(),
        deletedAt: 1,
      })
    ).toBe(false)
    expect(
      cardInCalendar({ calendarId: "cal" }, board, generalCalendar())
    ).toBe(true)
    expect(() =>
      CalendarStateSchema.parse({
        ...emptyCalendarState(),
        calendars: [{ ...generalCalendar(), deletedAt: 1 }],
      })
    ).toThrow()
  })
})
const ts = (v: string) => Date.parse(v)
const calendar = () =>
  CalendarSchema.parse({
    id: "cal",
    title: "Work",
    description: "",
    color: "#7866d5",
    visible: true,
    favorite: false,
    sourceBoardIds: [],
    showDeadlines: true,
    order: 0,
    reschedule: "manual",
    horizon: 14,
    updatedAt: 1,
    deletedAt: null,
  })
const event = (patch: Partial<CalendarEvent> = {}) =>
  CalendarEventSchema.parse({
    id: "event",
    calendarId: "cal",
    title: "Work",
    description: "",
    kind: "event",
    start: "2026-10-20T10:00:00Z",
    end: "2026-10-20T11:00:00Z",
    timeZone: "UTC",
    allDay: false,
    status: "planned",
    links: [],
    priority: "medium",
    flexible: false,
    pinned: false,
    syncCompletion: false,
    allowArchived: false,
    updatedAt: 1,
    deletedAt: null,
    ...patch,
  })
const sources = (): CalendarSources => ({
  cards: [
    CardSchema.parse({
      id: "card",
      title: "Task",
      body: "- [ ] [Script](#bordena-task=stable)",
      columnId: "section",
      position: "a0",
      updatedAt: 1,
      deletedAt: null,
    }),
  ],
  columns: [
    ColumnSchema.parse({
      id: "section",
      title: "To do",
      dashboardId: "board",
      position: "a0",
      updatedAt: 1,
      deletedAt: null,
    }),
  ],
  dashboards: [
    DashboardSchema.parse({
      id: "board",
      title: "Board",
      position: "a0",
      updatedAt: 1,
      deletedAt: null,
    }),
  ],
})
const profile = (): AvailabilityProfile => ({
  id: "profile",
  title: "Work hours",
  color: "#7866d5",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  dates: [],
  excludedDates: [],
  intervals: [
    { start: 600, end: 780 },
    { start: 1020, end: 1200 },
  ],
  breaks: [],
  updatedAt: 1,
})
const state = () => ({
  ...emptyCalendarState(),
  calendars: [
    { ...calendar(), profileId: "profile", reschedule: "smart" as const },
  ],
  profiles: [profile()],
  events: [
    event({
      kind: "block",
      flexible: true,
      links: [{ type: "card", id: "card" }],
    }),
  ],
})
describe("0.6 calendar intervals and time zones", () => {
  it.each([
    [
      [0, 60],
      [30, 90],
    ],
    [
      [0, 60],
      [0, 60],
      [0, 60],
    ],
    [
      [0, 100],
      [20, 40],
      [30, 50],
    ],
    [
      [0, 40],
      [30, 70],
      [60, 90],
    ],
    [
      [0, 1],
      [1, 2],
    ],
  ])("assigns accessible non-overlapping columns for %j", (...ranges) => {
    const input = ranges.map((r, index) => ({
        key: String(index),
        start: r[0],
        end: r[1],
      })),
      placed = layoutIntervals(input)
    expect(layoutIntervals([...input].reverse())).toEqual(placed)
    for (const a of placed)
      for (const b of placed)
        if (a.key !== b.key && a.start < b.end && a.end > b.start)
          expect(a.column).not.toBe(b.column)
  })
  it("treats touching edges as separate groups", () =>
    expect(
      layoutIntervals([
        { key: "a", start: 0, end: 10 },
        { key: "b", start: 10, end: 20 },
      ]).map((e) => e.columns)
    ).toEqual([1, 1]))
  it("rejects a nonexistent spring DST time", () =>
    expect(zonedInstant("2026-03-29T02:30", "Europe/Berlin")).toBeNull())
  it("selects the first ambiguous autumn hour deterministically", () =>
    expect(
      new Date(zonedInstant("2026-10-25T02:30", "Europe/Berlin")!).toISOString()
    ).toBe("2026-10-25T00:30:00.000Z"))
  it("converts Moscow midnight without UTC date slicing", () =>
    expect(wallTime("2026-10-19T22:30:00Z", "Europe/Moscow")).toBe(
      "2026-10-20T01:30"
    ))
  it("rejects reversed timestamps and invalid zones", () => {
    expect(() => event({ end: "2026-10-19T11:00:00Z" })).toThrow()
    expect(() => event({ timeZone: "invalid" })).toThrow()
  })
})
describe("bounded recurrence and stable instances", () => {
  const range = [ts("2026-10-01T00:00Z"), ts("2026-12-01T00:00Z")] as const
  it("creates daily instances without physical copies", () => {
    const e = event({
      recurrence: { frequency: "daily", interval: 1, count: 3 },
    })
    expect(calendarOccurrences(e, ...range)).toHaveLength(3)
    expect(e.exceptions).toBeUndefined()
  })
  it("supports weekdays and custom intervals", () => {
    const e = event({
      recurrence: { frequency: "weekly", interval: 2, weekdays: [1, 3, 5] },
    })
    expect(
      calendarOccurrences(e, ...range).every((o) =>
        [1, 3, 5].includes(new Date(o.start).getUTCDay())
      )
    ).toBe(true)
  })
  it("skips February for a monthly 31st, preserving March 31st", () => {
    const e = event({
      start: "2026-01-31T10:00:00Z",
      end: "2026-01-31T11:00:00Z",
      recurrence: { frequency: "monthly", interval: 1 },
    })
    expect(
      calendarOccurrences(e, ts("2026-01-01Z"), ts("2026-04-01Z")).map(
        (o) => o.day
      )
    ).toEqual(["2026-01-31", "2026-03-31"])
  })
  it("skips leap day in non-leap years", () => {
    const e = event({
      start: "2024-02-29T10:00:00Z",
      end: "2024-02-29T11:00:00Z",
      recurrence: { frequency: "yearly", interval: 1 },
    })
    expect(
      calendarOccurrences(e, ts("2025-01-01Z"), ts("2026-01-01Z"))
    ).toEqual([])
  })
  it("honors exclusions and persistent modified instance keys", () => {
    const e = event({
      recurrence: { frequency: "daily", interval: 1, count: 3 },
      exceptions: {
        "2026-10-20": null,
        "2026-10-21": {
          title: "Changed",
          start: "2026-11-01T14:00:00Z",
          end: "2026-11-01T15:00:00Z",
        },
      },
    })
    const o = calendarOccurrences(e, ts("2026-11-01Z"), ts("2026-11-02Z"))
    expect(o).toHaveLength(1)
    expect(o[0].key).toBe("event@2026-10-21")
    expect(o[0].event.title).toBe("Changed")
  })
  it("retains local recurrence time across DST", () => {
    const e = event({
      start: "2026-03-28T09:00:00Z",
      end: "2026-03-28T10:00:00Z",
      timeZone: "Europe/Berlin",
      recurrence: { frequency: "daily", interval: 1, count: 3 },
    })
    const list = calendarOccurrences(e, ts("2026-03-28Z"), ts("2026-04-01Z"))
    expect(list.map((o) => wallTime(o.start, e.timeZone).slice(11))).toEqual([
      "10:00",
      "10:00",
      "10:00",
    ])
    expect(list[1].start - list[0].start).toBe(23 * 3600000)
  })
  it("includes events spanning midnight and multiple days once", () =>
    expect(
      calendarOccurrences(
        event({ end: "2026-10-23T11:00:00Z" }),
        ts("2026-10-21Z"),
        ts("2026-10-22Z")
      )
    ).toHaveLength(1))
  it("bounds unlimited recurrence to the visible period", () =>
    expect(
      calendarOccurrences(
        event({ recurrence: { frequency: "daily", interval: 1 } }),
        ts("2040-01-01Z"),
        ts("2040-01-08Z")
      )
    ).toHaveLength(7))
})
describe("source identity, availability and scheduling", () => {
  const now = ts("2026-10-20T12:00:00Z")
  it("does not reserve intervals from deleted calendars", () => {
    const s = state()
    s.calendars.push({ ...s.calendars[0], id: "removed", deletedAt: 1 })
    s.events.push(
      event({
        id: "old-booking",
        calendarId: "removed",
        start: "2026-10-20T12:00:00Z",
        end: "2026-10-20T13:00:00Z",
      })
    )
    expect(planCalendar(s, sources(), now)[0].after.start).toBe(
      "2026-10-20T12:00:00.000Z"
    )
  })
  it("releases a simultaneously completed future session before placing another task", () => {
    const s = state(),
      model = sources()
    model.cards.push({
      ...model.cards[0],
      id: "finished",
      body: "- [x] [Done](#bordena-task=done)",
    })
    s.events.push(
      event({
        id: "complete-first",
        start: "2026-10-20T12:00:00Z",
        end: "2026-10-20T13:00:00Z",
        syncCompletion: true,
        links: [{ type: "checklist", id: "done", cardId: "finished" }],
      })
    )
    const result = planCalendar(s, model, now)
    expect(result.find((c) => c.id === "event")!.after.start).toBe(
      "2026-10-20T12:00:00.000Z"
    )
    expect(result.find((c) => c.id === "complete-first")!.after.status).toBe(
      "completed"
    )
  })
  it("ignores historical overnight profiles and uses the standard daily window", () => {
    const s = state()
    s.profiles[0].intervals = [{ start: 1320, end: 1560 }]
    s.events[0].end = "2026-10-20T14:00:00Z"
    expect(findScheduleSlot(s, s.events[0], now, [])).toEqual({
      start: ts("2026-10-20T12:00Z"),
      end: ts("2026-10-20T16:00Z"),
    })
  })
  it("keeps all-day recurrence at local midnight through DST", () => {
    const e = event({
      start: "2026-03-28T23:00:00Z",
      end: "2026-03-29T22:00:00Z",
      timeZone: "Europe/Berlin",
      allDay: true,
      recurrence: { frequency: "daily", interval: 1, count: 3 },
    })
    const occurrences = calendarOccurrences(
      e,
      ts("2026-03-28Z"),
      ts("2026-04-02Z")
    )
    expect(
      occurrences.map((o) => wallTime(o.end, e.timeZone).slice(11))
    ).toEqual(["00:00", "00:00", "00:00"])
  })
  it("keeps checklist identity across renaming and reorder", () => {
    const model = sources(),
      link = { type: "checklist" as const, id: "stable", cardId: "card" }
    expect(calendarSource(link, model).title).toBe("Script")
    model.cards[0].body = "- [ ] Other\n- [x] [Renamed](#bordena-task=stable)"
    expect(calendarSource(link, model)).toMatchObject({
      available: true,
      title: "Renamed",
      completed: true,
    })
  })
  it("never silently matches removed or duplicate checklist anchors by text", () => {
    const model = sources(),
      link = { type: "checklist" as const, id: "stable", cardId: "card" }
    model.cards[0].body = "- [ ] Script"
    expect(calendarSource(link, model).available).toBe(false)
    model.cards[0].body =
      "- [ ] [A](#bordena-task=stable)\n- [ ] [B](#bordena-task=stable)"
    expect(calendarSource(link, model).available).toBe(false)
  })
  it("preserves an unavailable source when a board is deleted", () => {
    const model = sources()
    model.dashboards[0].deletedAt = 2
    expect(calendarSource({ type: "card", id: "card" }, model).available).toBe(
      false
    )
  })
  it("rejects event cycles and duplicate IDs", () => {
    const s = state()
    s.events.push(
      event({ id: "second", links: [{ type: "event", id: "event" }] })
    )
    s.events[0].links = [{ type: "event", id: "second" }]
    expect(() => validateCalendarLinks(s, sources())).toThrow("Cyclic")
    expect(() =>
      CalendarStateSchema.parse({ ...s, calendars: [calendar(), calendar()] })
    ).toThrow()
  })
  it("splits overnight profiles and subtracts breaks", () => {
    const p = {
      ...profile(),
      intervals: [{ start: 1320, end: 1560 }],
      breaks: [{ start: 1380, end: 1440 }],
    }
    expect(
      availabilityWindows(p, "2026-10-21", "UTC").map((i) => [
        new Date(i.start).toISOString(),
        new Date(i.end).toISOString(),
      ])
    ).toEqual([
      ["2026-10-21T00:00:00.000Z", "2026-10-21T02:00:00.000Z"],
      ["2026-10-21T22:00:00.000Z", "2026-10-21T23:00:00.000Z"],
    ])
  })
  it("finds the nearest free interval without changing the source deadline", () => {
    const s = state(),
      model = sources()
    model.cards[0].deadline = "2026-10-21"
    s.events.push(
      event({
        id: "busy",
        start: "2026-10-20T12:00:00Z",
        end: "2026-10-20T13:00:00Z",
      })
    )
    const plan = planCalendar(s, model, now)
    expect(plan[0].after.start).toBe("2026-10-20T13:00:00.000Z")
    expect(model.cards[0].deadline).toBe("2026-10-21")
  })
  it.each(["manual", "pinned", "completed", "archived", "cancelled"])(
    "never moves %s work",
    (kind) => {
      const s = state(),
        model = sources()
      if (kind === "manual") s.events[0].reschedule = "manual"
      if (kind === "pinned") s.events[0].pinned = true
      if (kind === "completed") model.columns[0].done = true
      if (kind === "archived") model.cards[0].archived = true
      if (kind === "cancelled") s.events[0].status = "cancelled"
      expect(planCalendar(s, model, now)).toEqual([])
    }
  )
  it("does not lose an unschedulable block and consumes the failure once", () => {
    const s = state()
    s.profiles[0].intervals = []
    s.events[0].start = "2026-10-19T00:00:00Z"
    s.events[0].end = "2026-10-19T12:00:00Z"
    const first = planCalendar(s, sources(), now)
    expect(first[0].after.execution?.result).toBe("needs-planning")
    expect(first[0].after.start).toBe(s.events[0].start)
    s.events[0] = first[0].after
    expect(planCalendar(s, sources(), now + 1)).toEqual([])
  })
  it("does not repeat a movement on reload or override a later manual move", () => {
    const s = state()
    s.events[0] = planCalendar(s, sources(), now)[0].after
    expect(planCalendar(s, sources(), now + 1)).toEqual([])
    s.events[0].start = "2026-10-21T19:00:00Z"
    s.events[0].end = "2026-10-21T20:00:00Z"
    expect(planCalendar(s, sources(), now + 100)).toEqual([])
  })
  it("completes linked sessions only with explicit opt-in", () => {
    const s = state(),
      model = sources()
    model.columns[0].done = true
    expect(planCalendar(s, model, now)).toEqual([])
    s.events[0].syncCompletion = true
    expect(planCalendar(s, model, now)[0].after.status).toBe("completed")
  })
  it("respects source deadline as the automatic placement boundary", () => {
    const s = state()
    expect(findScheduleSlot(s, s.events[0], now, [], "2026-10-19")).toBeNull()
  })
  it("starts next-day placement at the documented 09:00 local boundary", () => {
    const s = state()
    s.events[0].reschedule = "next-day"
    expect(
      new Date(findScheduleSlot(s, s.events[0], now, [])!.start).toISOString()
    ).toBe("2026-10-21T09:00:00.000Z")
  })
  it("schedules identically with missing or contradictory legacy profiles without mutating them",()=>{
    const s=state(), before=structuredClone(s)
    const slot=findScheduleSlot(s,s.events[0],now,[])
    s.profiles=[]
    expect(findScheduleSlot(s,s.events[0],now,[])).toEqual(slot)
    const legacy=structuredClone(before)
    legacy.profiles[0].excludedDates=["2026-10-20"]
    expect(findScheduleSlot(legacy,legacy.events[0],now,[])).toEqual(slot)
    expect(before.profiles[0].excludedDates).toEqual([])
  })
  it("uses one nearest timer candidate", () => {
    const s = state()
    expect(nextCalendarDeadline(s, now)).toBeNull()
    s.events[0].end = "2026-10-21T11:00:00Z"
    expect(nextCalendarDeadline(s, now)).toBe(ts(s.events[0].end))
  })
})
