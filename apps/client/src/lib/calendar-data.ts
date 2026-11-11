import { useQuery } from "@tanstack/react-query"
import {
  CalendarStateSchema,
  emptyCalendarState,
  generalCalendar,
  GENERAL_CALENDAR_ID,
  type BordenaCalendar,
  type CalendarEvent,
  type Card,
  type Column,
  type Dashboard,
  type SidebarLayout,
} from "@bordena/contract"
import { CALENDAR_KEY } from "@bordena/core"
import { webDb } from "./adapters/web-db"
import { applyOperations } from "./exchange/changeset"
import { flushCardEdits } from "@bordena/core"

export function useCalendarState() {
  return useQuery({
    queryKey: ["calendar", "state"],
    queryFn: async () => {
      const state = CalendarStateSchema.parse(
        (await webDb.get("meta", CALENDAR_KEY)) ?? emptyCalendarState()
      )
      if (!state.calendars.some((c) => c.id === GENERAL_CALENDAR_ID))
        state.calendars.unshift(generalCalendar())
      return state
    },
  })
}
export function useCalendarSources() {
  return useQuery({
    queryKey: ["calendar", "sources"],
    queryFn: async () => {
      const [cards, columns, dashboards, sidebar] = await Promise.all([
        webDb.getAll<Card>("cards"),
        webDb.getAll<Column>("columns"),
        webDb.getAll<Dashboard>("dashboards"),
        webDb.get<SidebarLayout>("sidebar", "layout"),
      ])
      return { cards, columns, dashboards, sidebar }
    },
  })
}
export function calendarDefaults(title: string, order = 0): BordenaCalendar {
  return {
    id: crypto.randomUUID(),
    title,
    description: "",
    color: "#7866d5",
    sourceBoardIds: [],
    visible: true,
    favorite: false,
    order,
    reschedule: "manual",
    horizon: 14,
    showDeadlines: true,
    updatedAt: 0,
    deletedAt: null,
  }
}
export function eventDefaults(
  calendarId: string,
  start = new Date(),
  title = ""
): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    calendarId,
    title,
    description: "",
    kind: "event",
    start: start.toISOString(),
    end: new Date(start.getTime() + 3600000).toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    allDay: false,
    status: "planned",
    links: [],
    priority: "medium",
    flexible: false,
    pinned: false,
    syncCompletion: false,
    allowArchived: false,
    deletedAt: null,
    updatedAt: 0,
  }
}

/** Explicit block > card > board > general; missing/deleted targets fall back safely. */
export function planningCalendarId(
  calendars: BordenaCalendar[],
  card?: Pick<Card, "calendarId">,
  board?: Pick<Dashboard, "defaultCalendarId">,
  explicit?: string
) {
  return (
    [
      explicit,
      card?.calendarId,
      board?.defaultCalendarId,
      GENERAL_CALENDAR_ID,
    ].find((id) => id && calendars.some((c) => c.id === id && !c.deletedAt)) ??
    GENERAL_CALENDAR_ID
  )
}
export async function saveCalendar(calendar: BordenaCalendar) {
  await applyOperations([
    calendar.updatedAt
      ? {
          op: "update-calendar",
          id: calendar.id,
          expectedUpdatedAt: calendar.updatedAt,
          calendar,
        }
      : { op: "create-calendar", calendar },
  ])
}
export async function saveCalendarEvent(event: CalendarEvent) {
  await flushCardEdits()
  await applyOperations([
    event.updatedAt
      ? {
          op: "update-calendar-event",
          id: event.id,
          expectedUpdatedAt: event.updatedAt,
          event,
        }
      : { op: "create-calendar-event", event },
  ])
}
export function selectCalendar(id = "all") {
  localStorage.setItem("bordena:calendar:selected", id)
  window.dispatchEvent(
    new CustomEvent("bordena:calendar-select", { detail: id })
  )
}

/** Release a saved work block through the existing atomic history/Undo service. */
export async function returnCalendarBlockToTasks(
  event: CalendarEvent,
  instance?: string
) {
  if (
    !event.updatedAt ||
    event.kind !== "block" ||
    event.status !== "planned" ||
    !event.links.some((link) => link.type === "card")
  )
    throw new Error("Only a saved linked work block can be unscheduled")
  return cancelCalendarPlan(event, instance)
}

/** One atomic Changeset: optional draft changes and cancellation share a single Undo. */
export async function cancelCalendarPlan(
  value: CalendarEvent,
  instance?: string,
  draft?: CalendarEvent
) {
  await flushCardEdits()
  if (draft && instance)
    return applyOperations([
      {
        op: "update-calendar-instance",
        id: value.id,
        expectedUpdatedAt: value.updatedAt,
        day: instance,
        patch: {
          title: draft.title,
          start: draft.start,
          end: draft.end,
          status: "cancelled",
        },
      },
    ])
  if (draft)
    return saveCalendarEvent({
      ...draft,
      updatedAt: value.updatedAt,
      status: "cancelled",
    })
  return applyOperations([
    {
      op: "cancel-calendar-event",
      id: value.id,
      expectedUpdatedAt: value.updatedAt,
      instance,
    },
  ])
}
