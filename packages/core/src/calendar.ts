import type {
  AvailabilityProfile,
  CalendarEvent,
  CalendarState,
  ScheduleLink,
  Card,
  Column,
  Dashboard,
  SidebarLayout,
  BordenaCalendar,
} from "@bordena/contract"
import { GENERAL_CALENDAR_ID } from "@bordena/contract"
import { isCardCompleted } from "./board-layout"
import { deadlineInstant } from "@bordena/utils"
import { archivedAutomationBoards } from "./automation"
import { goalProgress } from "./goal-path"

export const CALENDAR_KEY = "bordena:calendar"
/** Custom calendars include explicit assignments and optional source scopes. */
export function cardInCalendar(
  card: Pick<Card, "calendarId">,
  board: Pick<Dashboard, "id" | "workspaceId" | "defaultCalendarId">,
  calendar: BordenaCalendar
): boolean {
  if (calendar.deletedAt) return false
  if (
    calendar.id === GENERAL_CALENDAR_ID ||
    (card.calendarId ?? board.defaultCalendarId) === calendar.id
  )
    return true
  return (
    (!!calendar.workspaceId || calendar.sourceBoardIds.length > 0) &&
    (!calendar.workspaceId ||
      calendar.workspaceId === (board.workspaceId ?? "default")) &&
    (!calendar.sourceBoardIds.length ||
      calendar.sourceBoardIds.includes(board.id))
  )
}
const DAY = 86400000
const formatters = new Map<string, Intl.DateTimeFormat>()
export function wallTime(instant: number | string, zone: string): string {
  let f = formatters.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    formatters.set(zone, f)
  }
  const p = Object.fromEntries(
    f.formatToParts(new Date(instant)).map((p) => [p.type, p.value])
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
/** Invalid DST wall times are rejected. An ambiguous hour chooses its first occurrence. */
export function zonedInstant(wall: string, zone: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall)) return null
  const utc = Date.parse(wall + "Z")
  if (!Number.isFinite(utc)) return null
  const offsets = new Set<number>()
  for (const shift of [-36, -12, 0, 12, 36]) {
    const sample = utc + shift * 3600000
    offsets.add(Date.parse(wallTime(sample, zone) + "Z") - sample)
  }
  const matches = [...offsets]
    .map((offset) => utc - offset)
    .filter((v) => wallTime(v, zone) === wall)
    .sort((a, b) => a - b)
  return matches[0] ?? null
}
export function calendarDayShift(day: string, count: number): string {
  return new Date(Date.parse(day + "T12:00:00Z") + count * DAY)
    .toISOString()
    .slice(0, 10)
}
export function calendarWeekday(day: string): number {
  return new Date(day + "T12:00:00Z").getUTCDay()
}
export interface CalendarOccurrence {
  key: string
  seriesId: string
  day: string
  start: number
  end: number
  event: CalendarEvent
}
/** Only the requested bounded period is materialized; overrides retain the original day key. */
export function calendarOccurrences(
  event: CalendarEvent,
  from: number,
  to: number,
  limit = 10000,
  includeCancelled = false
): CalendarOccurrence[] {
  if (
    event.deletedAt ||
    (event.status === "cancelled" && !includeCancelled) ||
    to <= from ||
    to - from > 400 * DAY
  )
    return []
  const start = Date.parse(event.start),
    duration = Date.parse(event.end) - start,
    zone = event.timeZone
  const firstWall = wallTime(start, zone),
    firstDay = firstWall.slice(0, 10),
    clock = firstWall.slice(11)
  // The source span is constant for every occurrence. Timed events do not use
  // a calendar-day span at all; avoid repeated Intl/date work in large years.
  const allDayLength = event.allDay
    ? Math.max(
        1,
        Math.round(
          (Date.parse(wallTime(event.end, zone).slice(0, 10) + "T12:00Z") -
            Date.parse(firstDay + "T12:00Z")) /
            DAY
        )
      )
    : 1
  const output: CalendarOccurrence[] = []
  const emit = (day: string, at: number) => {
    const override = event.exceptions?.[day]
    if (override === null) return
    const value = { ...event, ...override },
      s = override?.start ? Date.parse(override.start) : at,
      e = override?.end
        ? Date.parse(override.end)
        : event.allDay
          ? (zonedInstant(
              calendarDayShift(wallTime(s, zone).slice(0, 10), allDayLength) +
                "T00:00",
              zone
            ) ?? s + duration)
          : s + duration
    if (
      e > from &&
      s < to &&
      output.length < limit &&
      (includeCancelled || value.status !== "cancelled")
    )
      output.push({
        key: `${event.id}@${day}`,
        seriesId: event.id,
        day,
        start: s,
        end: e,
        event: value,
      })
  }
  if (!event.recurrence) {
    emit(firstDay, start)
    return output
  }
  const r = event.recurrence
  let day = r.count
    ? firstDay
    : calendarDayShift(
        wallTime(Math.max(start, from - duration), zone).slice(0, 10),
        -1
      )
  if (day < firstDay) day = firstDay
  const last = wallTime(to, zone).slice(0, 10),
    seen = new Set<string>()
  let generated = 0,
    iterations = 0
  while (day <= last && (!r.until || day <= r.until) && iterations++ < 200000) {
    const diff = Math.round(
      (Date.parse(day + "T12:00Z") - Date.parse(firstDay + "T12:00Z")) / DAY
    )
    const months =
      (Number(day.slice(0, 4)) - Number(firstDay.slice(0, 4))) * 12 +
      Number(day.slice(5, 7)) -
      Number(firstDay.slice(5, 7))
    const weeks = Math.floor((diff + ((calendarWeekday(firstDay) + 6) % 7)) / 7)
    const match =
      r.frequency === "daily"
        ? diff % r.interval === 0
        : r.frequency === "weekly"
          ? weeks % r.interval === 0 &&
            (r.weekdays ?? [calendarWeekday(firstDay)]).includes(
              calendarWeekday(day)
            )
          : r.frequency === "monthly"
            ? months % r.interval === 0 &&
              Number(day.slice(8)) === (r.monthDay ?? Number(firstDay.slice(8)))
            : (Number(day.slice(0, 4)) - Number(firstDay.slice(0, 4))) %
                r.interval ===
                0 && day.slice(5) === firstDay.slice(5)
    if (match) {
      generated++
      if (r.count && generated > r.count) break
      const at = zonedInstant(`${day}T${clock}`, zone)
      if (at !== null) {
        emit(day, at)
        seen.add(day)
      }
    }
    day = calendarDayShift(day, 1)
  }
  // An instance moved from outside the visible period must still be displayed.
  for (const [date, patch] of Object.entries(event.exceptions ?? {}))
    if (!seen.has(date) && patch?.start) {
      const at = zonedInstant(`${date}T${clock}`, zone)
      if (at !== null) emit(date, at)
    }
  return output.sort((a, b) => a.start - b.start || a.key.localeCompare(b.key))
}
export interface Interval {
  key: string
  start: number
  end: number
}
export function layoutIntervals<T extends Interval>(
  items: T[]
): (T & { column: number; columns: number })[] {
  const sorted = [...items].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.key.localeCompare(b.key)
  )
  const result: (T & { column: number; columns: number })[] = []
  let group: typeof result = [],
    ends: number[] = [],
    groupEnd = -Infinity
  const finish = () => {
    for (const event of group) event.columns = ends.length
    result.push(...group)
    group = []
    ends = []
  }
  for (const item of sorted) {
    if (item.start >= groupEnd) {
      finish()
      groupEnd = -Infinity
    }
    let column = ends.findIndex((end) => end <= item.start)
    if (column < 0) column = ends.length
    ends[column] = item.end
    groupEnd = Math.max(groupEnd, item.end)
    group.push({ ...item, column, columns: 1 })
  }
  finish()
  return result
}
export interface CalendarSources {
  cards: Card[]
  columns: Column[]
  dashboards: Dashboard[]
  sidebar?: SidebarLayout
}
export function calendarSource(
  link: ScheduleLink,
  sources: CalendarSources,
  state?: CalendarState
): {
  available: boolean
  title: string
  completed: boolean
  archived: boolean
  deadline?: string | null
  boardId?: string
} {
  const card = sources.cards.find(
    (c) =>
      c.id === (link.cardId ?? (link.type === "card" ? link.id : undefined)) &&
      !c.deletedAt
  )
  const column = sources.columns.find(
    (c) =>
      c.id ===
        (card?.columnId ?? (link.type === "section" ? link.id : undefined)) &&
      !c.deletedAt
  )
  const board = sources.dashboards.find(
    (b) =>
      b.id === (link.boardId ?? column?.dashboardId ?? link.id) && !b.deletedAt
  )
  const base = {
    available: false,
    title: "",
    completed: false,
    archived: false,
    boardId: board?.id,
  }
  if (["card", "checklist", "inline-date"].includes(link.type)) {
    if (!card || !column || !board) return base
    const value = {
      ...base,
      available: true,
      title: card.title,
      completed: isCardCompleted(card, column, board.layout),
      archived:
        !!card.archived ||
        archivedAutomationBoards(sources.dashboards, sources.sidebar).includes(
          board.id
        ),
      deadline: card.deadline,
    }
    if (link.type === "checklist") {
      const prose = card.body.replace(
        /(^|\n)\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\s*\2[^\n]*(?=\n|$)/g,
        "\n"
      )
      const matches = [
        ...prose.matchAll(
          /^\s*[-*+]\s+\[([ xX])\]\s+\[([^\n]*)\]\(#bordena-task=([a-zA-Z0-9_-]+)\)\s*$/gm
        ),
      ].filter((m) => m[3] === link.id)
      return matches.length === 1
        ? {
            ...value,
            title: matches[0][2],
            completed: matches[0][1].toLowerCase() === "x",
          }
        : base
    }
    if (link.type === "inline-date") {
      const matches = [
        ...card.body.matchAll(
          /\[([^\n]*?)\]\(#bordena-date=([^\s)]+)&id=([a-zA-Z0-9_-]+)\)/g
        ),
      ].filter((m) => m[3] === link.id)
      return matches.length === 1 ? { ...value, title: matches[0][1] } : base
    }
    return value
  }
  if (link.type === "workspace") {
    const w = sources.sidebar?.workspaces?.find((w) => w.id === link.id)
    return {
      ...base,
      available: !!w,
      title: w?.title ?? "",
      archived: !!w?.archived,
    }
  }
  if (link.type === "project") {
    const p = sources.sidebar?.items.find(
      (p) => p.type === "folder" && p.id === link.id
    )
    return {
      ...base,
      available: !!p,
      title: p?.type === "folder" ? p.title : "",
      archived: p?.type === "folder" && !!p.archived,
    }
  }
  if (link.type === "event") {
    const e = state?.events.find((e) => e.id === link.id && !e.deletedAt)
    return {
      ...base,
      available: !!e,
      title: e?.title ?? "",
      completed: e?.status === "completed",
    }
  }
  if (!board) return base
  if (link.type === "stage" || link.type === "goal-step") {
    const stage = board.layout?.stages.find((s) => s.id === link.id),
      step = board.goalPath?.steps.find((s) => s.id === link.id)
    return {
      ...base,
      available: !!stage,
      title: stage?.title ?? "",
      completed: step?.status === "completed",
      archived: !!board.archived,
      deadline: board.deadline,
    }
  }
  return {
    ...base,
    available:
      link.type === "section"
        ? !!column
        : link.type === "goal"
          ? !!board.goalPath
          : true,
    title: column?.title ?? board.title,
    archived: !!board.archived,
    deadline: board.deadline,
    completed: link.type === "goal" && goalProgress(board.goalPath) === 100,
  }
}
export function validateCalendarLinks(
  state: CalendarState,
  sources: CalendarSources,
  ids?: Set<string>
): void {
  const visit = (id: string, path: Set<string>) => {
    if (path.has(id)) throw new Error("Cyclic calendar links")
    const event = state.events.find((e) => e.id === id)
    if (!event) return
    if (path.size > 100) throw new Error("Calendar link depth exceeded")
    for (const link of event.links)
      if (link.type === "event") visit(link.id, new Set([...path, id]))
  }
  for (const event of state.events) {
    if (ids?.has(event.id))
      for (const link of event.links)
        if (!calendarSource(link, sources, state).available)
          throw new Error("Calendar source is unavailable")
    visit(event.id, new Set())
  }
}
export function availabilityWindows(
  profile: AvailabilityProfile,
  day: string,
  zone: string
): Interval[] {
  if (profile.excludedDates.includes(day)) return []
  const build = (date: string) => {
    if (
      profile.excludedDates.includes(date) ||
      (!profile.dates.includes(date) &&
        !profile.weekdays.includes(calendarWeekday(date)))
    )
      return []
    const at = (minutes: number) =>
      zonedInstant(
        `${calendarDayShift(date, Math.floor(minutes / 1440))}T${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
        zone
      )
    let slots = profile.intervals.flatMap((i, index) => {
      const start = at(i.start),
        end = at(i.end)
      return start !== null && end !== null && end > start
        ? [{ key: `${date}:${index}`, start, end }]
        : []
    })
    for (const pause of profile.breaks) {
      const start = at(pause.start),
        end = at(pause.end)
      if (start === null || end === null) continue
      slots = slots.flatMap((s) =>
        end <= s.start || start >= s.end
          ? [s]
          : [
              { ...s, end: Math.min(s.end, start) },
              { ...s, start: Math.max(s.start, end) },
            ].filter((x) => x.end > x.start)
      )
    }
    return slots
  }
  const start = zonedInstant(day + "T00:00", zone),
    end = zonedInstant(calendarDayShift(day, 1) + "T00:00", zone)
  if (start === null || end === null) return []
  return [...build(calendarDayShift(day, -1)), ...build(day)]
    .map((s) => ({
      ...s,
      start: Math.max(s.start, start),
      end: Math.min(s.end, end),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)
}
export function findScheduleSlot(
  state: CalendarState,
  event: CalendarEvent,
  now: number,
  busy: Interval[],
  deadline?: string | null
): { start: number; end: number } | null {
  const calendar = state.calendars.find(
    (c) => c.id === event.calendarId && !c.deletedAt
  )
  if (!calendar) return null
  // Historical profiles remain exportable but no longer control scheduling.
  // Simple daily planning window: 09:00–20:00 in the device zone.
  const profile: AvailabilityProfile = {
    id: "standard",
    title: "",
    color: "#7866d5",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    dates: [],
    excludedDates: [],
    intervals: [{ start: 540, end: 1200 }],
    breaks: [],
    updatedAt: 0,
  }
  const duration = Date.parse(event.end) - Date.parse(event.start),
    mode = event.reschedule ?? calendar.reschedule,
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = wallTime(now, zone).slice(0, 10),
    firstDay = mode === "next-day" ? calendarDayShift(today, 1) : today
  const bound = deadline ? deadlineInstant(deadline) : Infinity
  const occupied = [...busy].sort(
    (a, b) => a.start - b.start || a.key.localeCompare(b.key)
  )
  const windows: Interval[] = []
  for (let d = 0; d < calendar.horizon; d++)
    windows.push(
      ...availabilityWindows(profile, calendarDayShift(firstDay, d), zone)
    )
  const merged: Interval[] = []
  for (const slot of windows.sort(
    (a, b) => a.start - b.start || a.end - b.end
  )) {
    const last = merged.at(-1)
    if (last && slot.start <= last.end) last.end = Math.max(last.end, slot.end)
    else merged.push({ ...slot })
  }
  for (const slot of merged) {
    let start = Math.max(slot.start, Math.ceil(now / 300000) * 300000)
    for (const other of occupied) {
      if (other.end <= start) continue
      if (other.start >= start + duration) break
      start = Math.max(start, other.end)
    }
    if (start + duration <= Math.min(slot.end, bound))
      return { start, end: start + duration }
  }
  return null
}
export interface CalendarChange {
  id: string
  before: CalendarEvent
  after: CalendarEvent
  reason: string
}
/** Pure, finite, deterministic scheduler. Only explicitly enabled flexible work is moved. */
export function planCalendar(
  state: CalendarState,
  sources: CalendarSources,
  now: number
): CalendarChange[] {
  const eligible = state.events.some(
    (e) =>
      !e.deletedAt &&
      e.status === "planned" &&
      (e.syncCompletion ||
        (e.kind === "block" &&
          e.flexible &&
          !e.pinned &&
          !e.recurrence &&
          Date.parse(e.end) <= now &&
          (e.reschedule ??
            state.calendars.find((c) => c.id === e.calendarId)?.reschedule) !==
            "manual" &&
          e.execution?.key !== `${e.start}/${e.end}`))
  )
  if (!eligible) return []
  const changes: CalendarChange[] = [],
    busy: Interval[] = []
  const sourceInfo = new Map(
    state.events.map((event) => [
      event.id,
      event.links
        .filter((l) =>
          ["card", "checklist", "goal-step", "goal"].includes(l.type)
        )
        .map((link) => calendarSource(link, sources, state)),
    ])
  )
  const willComplete = new Set(
    state.events
      .filter(
        (event) =>
          event.syncCompletion &&
          sourceInfo.get(event.id)!.length > 0 &&
          sourceInfo
            .get(event.id)!
            .every(
              (source) =>
                source.available &&
                source.completed &&
                (event.allowArchived || !source.archived)
            )
      )
      .map((event) => event.id)
  )
  const earliest = now,
    latest = now + 90 * DAY
  for (const event of state.events)
    if (
      state.calendars.some((c) => c.id === event.calendarId && !c.deletedAt) &&
      !willComplete.has(event.id)
    )
      for (const occurrence of calendarOccurrences(event, earliest, latest))
        if (occurrence.event.status === "planned") busy.push(occurrence)
  const deadlines = new Map(
    state.events.map((event) => [
      event.id,
      Math.min(
        Infinity,
        ...sourceInfo.get(event.id)!.flatMap((source) => {
          const value = source.deadline
          return value ? [deadlineInstant(value)] : []
        })
      ),
    ])
  )
  const ordered = [...state.events].sort(
    (a, b) =>
      ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority] ||
      deadlines.get(a.id)! - deadlines.get(b.id)! ||
      Date.parse(a.end) - Date.parse(b.end) ||
      a.id.localeCompare(b.id)
  )
  for (const event of ordered) {
    const calendar = state.calendars.find(
      (c) => c.id === event.calendarId && !c.deletedAt
    )
    if (!calendar || event.deletedAt || event.status !== "planned") continue
    const linked = sourceInfo.get(event.id)!
    if (
      linked.some((s) => !s.available || (!event.allowArchived && s.archived))
    )
      continue
    if (
      event.syncCompletion &&
      linked.length &&
      linked.every((s) => s.completed)
    ) {
      const after = {
        ...event,
        status: "completed" as const,
        updatedAt: now,
        execution: {
          key: `complete:${event.updatedAt}`,
          result: "completed" as const,
          reason: "source-completed",
          at: now,
        },
      }
      changes.push({
        id: event.id,
        before: event,
        after,
        reason: "source-completed",
      })
      continue
    }
    const mode = event.reschedule ?? calendar.reschedule
    // Recurring sessions require an explicit instance edit; never move an entire series implicitly.
    if (
      mode === "manual" ||
      event.pinned ||
      !event.flexible ||
      event.recurrence ||
      event.kind !== "block" ||
      !linked.length ||
      linked.some((s) => s.completed) ||
      Date.parse(event.end) > now
    )
      continue
    const key = `${event.start}/${event.end}`
    if (event.execution?.key === key) continue
    const slot = findScheduleSlot(
      state,
      event,
      now,
      busy.filter((b) => !b.key.startsWith(event.id + "@")),
      linked
        .filter((s) => s.deadline)
        .sort(
          (a, b) => deadlineInstant(a.deadline!) - deadlineInstant(b.deadline!)
        )[0]?.deadline
    )
    const reason = slot
      ? "missed-session"
      : linked.some((s) => s.deadline && deadlineInstant(s.deadline) < now)
        ? "deadline-passed"
        : "no-free-slot"
    const after: CalendarEvent = {
      ...event,
      updatedAt: now,
      execution: {
        key,
        result: slot ? "moved" : "needs-planning",
        reason,
        at: now,
      },
      ...(slot
        ? {
            start: new Date(slot.start).toISOString(),
            end: new Date(slot.end).toISOString(),
          }
        : {}),
    }
    changes.push({
      id: event.id,
      before: event,
      after,
      reason: after.execution!.reason,
    })
    if (slot) busy.push({ key: event.id, ...slot })
  }
  return changes
}
export function nextCalendarDeadline(
  state: CalendarState,
  now: number
): number | null {
  let next = Infinity
  for (const event of state.events) {
    const calendar = state.calendars.find(
      (c) => c.id === event.calendarId && !c.deletedAt
    )
    if (
      !calendar ||
      event.deletedAt ||
      event.status !== "planned" ||
      event.pinned ||
      !event.flexible ||
      event.recurrence ||
      (event.reschedule ?? calendar.reschedule) === "manual"
    )
      continue
    const end = Date.parse(event.end)
    if (end > now) next = Math.min(next, end)
  }
  return Number.isFinite(next) ? next : null
}
