import { calendarDayShift, wallTime, zonedInstant } from "@bordena/core"
import type { CalendarEvent } from "@bordena/contract"

/** Change the local day, retaining time and elapsed duration (calendar days for all-day events). */
export function calendarEventOnDate(
  event: CalendarEvent,
  day: string,
  zone = event.timeZone
): CalendarEvent {
  if (event.allDay) zone = event.timeZone
  const localStart = wallTime(event.start, zone)
  const start = zonedInstant(day + "T" + localStart.slice(11), zone)
  if (start === null) throw new Error("Unavailable local time")
  const end = event.allDay
    ? zonedInstant(
        calendarDayShift(
          day,
          Math.max(
            1,
            Math.round(
              (Date.parse(wallTime(event.end, event.timeZone).slice(0, 10)) -
                Date.parse(localStart.slice(0, 10))) /
                86400000
            )
          )
        ) + "T00:00",
        event.timeZone
      )
    : start + Date.parse(event.end) - Date.parse(event.start)
  if (end === null || end <= start) throw new Error("Unavailable local time")
  return {
    ...event,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }
}
