// Deadlines are plain `YYYY-MM-DD` calendar dates. This package keeps no
// runtime dependencies so the server can load it as freely as the clients.
import { localeSnapshot } from "@bordena/i18n/locale"

export type DeadlineStatus = "overdue" | "soon" | "upcoming"

/** How far ahead the app's upcoming view looks. */
export const UPCOMING_DAYS = 60

/** Date-only deadlines last through the local day; timed values honor their offset. */
export function deadlineInstant(value: string): number {
  return new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999` : value
  ).getTime()
}

/** Editing an offset timestamp must show its local calendar date, not slice its UTC text. */
export function deadlineLocalParts(value: string | null): {
  date: string
  time: string
} {
  if (!value) return { date: "", time: "" }
  if (!value.includes("T")) return { date: value, time: "" }
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return { date: "", time: "" }
  return {
    date: deadlineCalendarDate(value),
    time: `${String(instant.getHours()).padStart(2, "0")}:${String(instant.getMinutes()).padStart(2, "0")}`,
  }
}
/** Freeze the selected local offset (including DST) in timed values. Reject nonexistent DST times. */
export function localDeadline(date: string, time = ""): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (time && !/^\d{2}:\d{2}$/.test(time))
  )
    return null
  const value = new Date(`${date}T${time || "12:00"}:00`)
  if (
    !Number.isFinite(value.getTime()) ||
    deadlineCalendarDate(value.toISOString()) !== date
  )
    return null
  if (!time) return date
  const expected = `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
  if (expected !== time) return null
  const offset = -value.getTimezoneOffset(),
    sign = offset < 0 ? "-" : "+",
    minutes = Math.abs(offset)
  return `${date}T${time}:00${sign}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

/** Local `YYYY-MM-DD` for today, the reference point for every status below. */
export function todayIso(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}
export function deadlineCalendarDate(value: string): string {
  if (!value.includes("T")) return value
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** The `YYYY-MM-DD` `days` away from `iso`. Parsed as UTC and shifted in UTC, so
 * a DST boundary can't land the result on the wrong calendar day. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole days from today to the deadline (negative once it's in the past). */
function daysUntil(iso: string): number {
  const today = new Date(todayIso()).getTime()
  const target = new Date(deadlineCalendarDate(iso)).getTime()
  return Math.round((target - today) / 86_400_000)
}

/** Buckets a deadline by how close it is, for color-coding. */
export function deadlineStatus(iso: string): DeadlineStatus {
  if (iso.includes("T") && new Date(iso).getTime() < Date.now())
    return "overdue"
  const days = daysUntil(iso)
  if (days < 0) return "overdue"
  if (days <= 3) return "soon"
  return "upcoming"
}

/** A soon deadline reads as relative time ("in 3 days") rather than a date. */
export function deadlineRelative(iso: string): string {
  const days = daysUntil(iso)
  if (localeSnapshot() === "ru")
    return new Intl.RelativeTimeFormat("ru", { numeric: "auto" }).format(
      days,
      "day"
    )
  if (days === -1) return "yesterday"
  if (days < 0) return `${-days} days ago`
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  return `in ${days} days`
}

/** Renders an ISO date (`YYYY-MM-DD`) as `DD.MM.YYYY`. */
export function formatDeadline(iso: string): string {
  if (iso.includes("T"))
    return new Date(iso).toLocaleString(localeSnapshot(), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  const [year, month, day] = iso.split("-")
  return `${day}.${month}.${year}`
}

/** Same as `formatDeadline`, but drops the year when it's the current one. */
export function formatDeadlineShort(iso: string): string {
  if (iso.includes("T"))
    return new Date(iso).toLocaleString(localeSnapshot(), {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  const [year, month, day] = iso.split("-")
  const sameYear = Number(year) === new Date().getFullYear()
  return sameYear ? `${day}.${month}` : `${day}.${month}.${year}`
}

/** A short relative label: how many days are left, or how long it's overdue. */
export function deadlineLabel(iso: string): string {
  const days = daysUntil(iso)
  if (localeSnapshot() === "ru")
    return new Intl.RelativeTimeFormat("ru", { numeric: "auto" }).format(
      days,
      "day"
    )
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  if (days > 1) return `${days} days left`
  return `${-days} days ago`
}

/** The day a date falls on, spelled out — the label people actually scan for.
 * Parsed as UTC to match `addDays`, so the weekday can't drift by a day. */
export function weekday(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(localeSnapshot(), {
    weekday: "long",
    timeZone: "UTC",
  })
}

/** A date as `21 August`, ordered by locale — the year tacked on only when it
 * isn't the current one. Parsed as UTC to match `weekday`. */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const sameYear = d.getUTCFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(localeSnapshot(), {
    day: "numeric",
    month: "long",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  })
}
