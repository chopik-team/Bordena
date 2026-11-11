import { CalendarPicker } from "./calendar-picker"
import { calendarEventOnDate } from "@/lib/calendar-event-date"
import { CalendarYearView } from "./calendar-year-view"
import { shiftCalendarPeriod, hasPlannedWork } from "@bordena/core"
import { FocusExit } from "../navigation/presentation-controls"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import { useT, useLocale } from "@bordena/i18n"
import {
  Button,
  DateInput,
  SidebarTrigger,
  Modal,
  ModalContent,
  ModalTitle,
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@bordena/ui-kit"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  MoreHorizontal,
  SlidersHorizontal,
  PanelRight,
  Pencil,
  ExternalLink,
} from "lucide-react"
import {
  emptyCalendarState,
  GENERAL_CALENDAR_ID,
  type CalendarEvent,
  type BordenaCalendar,
  type ScheduleLink,
} from "@bordena/contract"
import {
  calendarDayShift,
  calendarWeekday,
  wallTime,
  zonedInstant,
  calendarOccurrences,
  layoutIntervals,
  calendarSource,
  isCardCompleted,
  deadlineInstant,
  type CalendarOccurrence,
  setFolderCollapsed,
  cardInCalendar,
} from "@bordena/core"
import {
  useCalendarState,
  useCalendarSources,
  calendarDefaults,
  eventDefaults,
  saveCalendarEvent,
  returnCalendarBlockToTasks,
  planningCalendarId,
} from "@/lib/calendar-data"
import { AppShell } from "../app/app-shell"
import { CalendarEditor, EventEditor } from "./calendar-editors"
import { parseInlineDate } from "@/lib/inline-date"
import { formatLocalError } from "@/lib/local-error"
import { setPreferences } from "@/lib/preferences"
import { changeNavigation } from "@/lib/navigation"
import { z } from "zod"
import { ViewSwitcher } from "../navigation/view-switcher"
import { useUiFlag } from "@/lib/ui-state"
import { installMonthWheel, installSmoothWheel } from "@/lib/smooth-wheel"

const NO_DECK = { id: "", sort: [] },
  today = () =>
    wallTime(
      Date.now(),
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ).slice(0, 10)
type View = "day" | "week" | "month" | "agenda" | "year"
interface ViewSettings {
  view: View
  date: string
  query: string
  project: string
  weekStart: number
  snap: number
  zoom: number
  status: string
  sort: string
  visibleCalendarIds?: string[]
  taskPriority?: string
}
const viewDefaults: ViewSettings = {
  view: "week",
  date: today(),
  query: "",
  project: "",
  weekStart: 1,
  snap: 15,
  zoom: 64,
  status: "active",
  sort: "time",
}
function readSettings(): ViewSettings {
  try {
    const parsed = z
      .object({
        view: z.enum(["day", "week", "month", "agenda", "year"]),
        date: z.iso.date(),
        query: z.string().max(4096),
        project: z.string().max(128),
        weekStart: z.union([z.literal(0), z.literal(1)]),
        snap: z.union([
          z.literal(5),
          z.literal(15),
          z.literal(30),
          z.literal(60),
        ]),
        zoom: z.number().min(40).max(140),
        status: z.enum(["active", "all", "completed", "cancelled"]),
        sort: z.enum(["time", "title"]),
        visibleCalendarIds: z.array(z.string().max(128)).max(1000).optional(),
        taskPriority: z.enum(["", "high", "medium", "low", "none"]).optional(),
      })
      .partial()
      .safeParse(
        JSON.parse(localStorage.getItem("bordena:calendar:view") ?? "{}")
      )
    return {
      ...viewDefaults,
      ...(parsed.success ? parsed.data : {}),
    }
  } catch {
    return viewDefaults
  }
}
interface DisplayOccurrence extends CalendarOccurrence {
  deadline?: boolean
  marker?: string
  rawStart?: number
  rawEnd?: number
}
interface DragInfo {
  item?: DisplayOccurrence
  cardId?: string
  resize?: boolean
  startX: number
  startY: number
  start: number
  end: number
}
function shiftMonth(day: string, direction: number) {
  const date = new Date(day + "T12:00Z")
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + direction)
  return date.toISOString().slice(0, 10)
}
export function CalendarPage() {
  return (
    <AppShell deck={NO_DECK}>
      <CalendarView />
    </AppShell>
  )
}
export function CalendarView() {
  const t = useT(),
    locale = useLocale(),
    [, navigate] = useLocation(),
    { data: rawState } = useCalendarState(),
    { data: sources } = useCalendarSources()
  const [focus, setFocus] = useUiFlag("focus")
  const [sideMode, setSideMode] = useState<"tasks" | "details" | "filters">(
    "tasks"
  )
  const [selectedItem, setSelectedItem] = useState<DisplayOccurrence | null>(
    null
  )
  const [advanced, setAdvanced] = useState(false)
  const [releasedCard, setReleasedCard] = useState<string | null>(null)
  const [revealedCard, setRevealedCard] = useState<string | null>(null)
  const [focusDetail, setFocusDetail] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setFocusDetail(false), 0)
    return () => clearTimeout(timer)
  }, [focus])
  const [context, setContext] = useState<{
    item: DisplayOccurrence
    x: number
    y: number
  } | null>(null)
  const state = useMemo(() => rawState ?? emptyCalendarState(), [rawState])
  const [settings, setSettings] = useState(readSettings),
    [now, setNow] = useState(() => Date.now()),
    [selected, setSelected] = useState(
      () => localStorage.getItem("bordena:calendar:selected") ?? "all"
    )
  const [calendarEdit, setCalendarEdit] = useState<BordenaCalendar | null>(
      null
    ),
    [eventEdit, setEventEdit] = useState<{
      event: CalendarEvent
      instance?: string
      intent?: "unschedule"
    } | null>(null)
  const [taskPanel, setTaskPanel] = useState(
      () => localStorage.getItem("bordena:calendar:tasks-hidden") === "false"
    ),
    [estimate, setEstimate] = useState(60),
    [returning, setReturning] = useState(false),
    [error, setError] = useState(""),
    [moreDay, setMoreDay] = useState<string | null>(null),
    [agendaLimit, setAgendaLimit] = useState(300),
    [monthLimit, setMonthLimit] = useState(1),
    [drag, setDrag] = useState<DragInfo | null>(null),
    [preview, setPreview] = useState<{ start: number; end: number } | null>(
      null
    )
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  useEffect(() => () => clearTimeout(clickTimer.current), [])
  const grid = useRef<HTMLDivElement>(null),
    ignoreClick = useRef(false),
    weekScroll = useRef<HTMLDivElement>(null),
    taskScroll = useRef<HTMLElement>(null),
    pendingTasks = useRef(new Set<string>())
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const patch = (v: Partial<ViewSettings>) =>
    setSettings((s) => ({ ...s, ...v }))
  const calendars = state.calendars
    .filter((c) => !c.deletedAt)
    .map((c) => ({
      ...c,
      title: c.id === GENERAL_CALENDAR_ID ? t("Общий календарь") : c.title,
      visible: settings.visibleCalendarIds
        ? settings.visibleCalendarIds.includes(c.id)
        : c.visible,
    }))
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        a.order - b.order ||
        a.id.localeCompare(b.id)
    )
  const activeCalendars = calendars.filter((c) => c.visible)
  const [nativeDrag, setNativeDrag] = useState<DisplayOccurrence | null>(null)
  const [dropTasks, setDropTasks] = useState(false)
  const hoverNavigation = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  useEffect(() => () => clearTimeout(hoverNavigation.current), [])
  const hasCalendars = calendars.length > 0
  const activeIds = new Set(activeCalendars.map((c) => c.id))
  const draftEvent = useCallback(
    (start?: number, cardId?: string): CalendarEvent | null => {
      const card = sources?.cards.find((c) => c.id === cardId)
      const board = sources?.dashboards.find(
        (b) =>
          b.id ===
          sources.columns.find((c) => c.id === card?.columnId)?.dashboardId
      )
      const calendar = state.calendars.find(
        (c) =>
          c.id ===
          planningCalendarId(
            state.calendars,
            card,
            board,
            card ? undefined : selected
          )
      )
      if (!calendar || (cardId && !card)) return null
      const at = start ?? zonedInstant(settings.date + "T10:00", zone)!
      return {
        ...eventDefaults(
          calendar.id,
          new Date(at),
          card ? card.title.trim() || t("Без названия") : ""
        ),
        kind: card ? ("block" as const) : ("event" as const),
        end: new Date(at + estimate * 60000).toISOString(),
        priority:
          card?.priority === "low" || card?.priority === "high"
            ? card.priority
            : ("medium" as const),
        links: card ? [{ type: "card" as const, id: card.id }] : [],
      }
    },
    [state, sources, selected, settings.date, zone, estimate, t]
  )
  const create = useCallback(
    (start?: number, cardId?: string) => {
      const event = draftEvent(start, cardId)
      if (event) setEventEdit({ event })
      else if (!cardId)
        setCalendarEdit(
          calendarDefaults(t("Новый календарь"), state.calendars.length)
        )
    },
    [draftEvent, t, state.calendars.length]
  )
  useEffect(() => {
    localStorage.setItem("bordena:calendar:tasks-hidden", String(!taskPanel))
  }, [taskPanel])
  useEffect(() => {
    localStorage.setItem("bordena:calendar:view", JSON.stringify(settings))
  }, [settings])
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(clock)
  }, [])
  useEffect(() => {
    localStorage.setItem("bordena:calendar:selected", selected)
  }, [selected])
  useEffect(() => {
    const select = (e: Event) => setSelected((e as CustomEvent<string>).detail)
    const add = () =>
      setCalendarEdit(
        calendarDefaults(t("Новый календарь"), state.calendars.length)
      )
    const schedule = (e: Event) =>
      create(undefined, (e as CustomEvent<{ cardId: string }>).detail.cardId)
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"],[role="dialog"]'
        )
      )
        return
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault()
        create()
      }
      if (e.key === "Escape") {
        setDrag(null)
        setPreview(null)
        ignoreClick.current = true
      }
      if (!e.ctrlKey && !e.altKey && e.key.toLowerCase() === "t")
        patch({ date: today() })
      if (
        !e.ctrlKey &&
        !e.altKey &&
        ["ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault()
        setSettings((s) => ({
          ...s,
          date: shiftCalendarPeriod(
            s.date,
            s.view,
            e.key === "ArrowLeft" ? -1 : 1
          ),
        }))
      }
    }
    const viewEvents = (
      ["day", "week", "month", "agenda", "year"] as const
    ).map((view) => {
      const name = "bordena:calendar-view-" + view
      const fn = () => patch({ view })
      window.addEventListener(name, fn)
      return { name, fn }
    })
    window.addEventListener("bordena:calendar-select", select)
    const addEvent = () => create()
    const goToday = () => patch({ date: today() })
    window.addEventListener("bordena:create-event", addEvent)
    window.addEventListener("bordena:calendar-today", goToday)
    window.addEventListener("bordena:create-calendar", add)
    window.addEventListener("bordena:schedule-card", schedule)
    window.addEventListener("keydown", key)
    return () => {
      viewEvents.forEach(({ name, fn }) => window.removeEventListener(name, fn))
      window.removeEventListener("bordena:calendar-select", select)
      window.removeEventListener("bordena:create-event", addEvent)
      window.removeEventListener("bordena:calendar-today", goToday)
      window.removeEventListener("bordena:create-calendar", add)
      window.removeEventListener("bordena:schedule-card", schedule)
      window.removeEventListener("keydown", key)
    }
  }, [state.calendars.length, create, t])
  useEffect(() => {
    const cardId = new URLSearchParams(location.search).get("card")
    if (cardId && sources && calendars.length) {
      const timer = setTimeout(() => create(undefined, cardId), 0)
      return () => clearTimeout(timer)
    }
  }, [sources, calendars.length, create])
  useEffect(() => {
    const eventId = new URLSearchParams(location.search).get("event")
    if (eventId) {
      const event = state.events.find((e) => e.id === eventId && !e.deletedAt)
      if (event) {
        const timer = setTimeout(() => {
          setEventEdit({ event })
          history.replaceState(null, "", "/calendar")
        }, 0)
        return () => clearTimeout(timer)
      }
    }
  }, [state])
  useEffect(() => {
    if (
      new URLSearchParams(location.search).get("new") === "event" &&
      sources &&
      calendars.length
    ) {
      const timer = setTimeout(() => {
        create()
        history.replaceState(null, "", "/calendar")
      }, 0)
      return () => clearTimeout(timer)
    }
    const requestedView = new URLSearchParams(location.search).get("view")
    if (
      ["day", "week", "month", "agenda", "year"].includes(requestedView ?? "")
    ) {
      const timer = setTimeout(() => {
        patch({ view: requestedView as View })
        history.replaceState(null, "", "/calendar")
      }, 0)
      return () => clearTimeout(timer)
    }
    if (new URLSearchParams(location.search).get("today")) {
      const timer = setTimeout(() => {
        setSettings((value) => ({ ...value, date: today() }))
        history.replaceState(null, "", "/calendar")
      }, 0)
      return () => clearTimeout(timer)
    }
    if (new URLSearchParams(location.search).get("new") === "calendar") {
      const timer = setTimeout(
        () =>
          setCalendarEdit(
            calendarDefaults(t("Новый календарь"), state.calendars.length)
          ),
        0
      )
      return () => clearTimeout(timer)
    }
  }, [state.calendars.length, t, sources, calendars.length, create])
  const firstDay = useMemo(() => {
    if (settings.view === "year") return settings.date.slice(0, 4) + "-01-01"
    if (settings.view === "month") {
      const first = settings.date.slice(0, 7) + "-01"
      return calendarDayShift(
        first,
        -((calendarWeekday(first) - settings.weekStart + 7) % 7)
      )
    }
    if (settings.view === "week")
      return calendarDayShift(
        settings.date,
        -((calendarWeekday(settings.date) - settings.weekStart + 7) % 7)
      )
    return settings.date
  }, [settings.date, settings.view, settings.weekStart])
  const days = useMemo(
    () =>
      Array.from(
        {
          length:
            settings.view === "day" ? 1 : settings.view === "week" ? 7 : 42,
        },
        (_, i) => calendarDayShift(firstDay, i)
      ),
    [firstDay, settings.view]
  )
  useEffect(() => {
    const element = weekScroll.current
    if (!element || settings.view !== "month") return
    const update = () => {
      const rowHeight = (element.clientHeight - 36) / (days.length / 7)
      const eventHeight =
        window.innerHeight <= 700 ? 26 : window.innerHeight <= 850 ? 40 : 58
      setMonthLimit(
        Math.max(1, Math.min(4, Math.floor((rowHeight - 58) / eventHeight)))
      )
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [settings.view, days.length, hasCalendars])
  const from = zonedInstant(firstDay + "T00:00", zone)!,
    to =
      settings.view === "year"
        ? zonedInstant(
            String(Number(settings.date.slice(0, 4)) + 1) + "-01-01T00:00",
            zone
          )!
        : zonedInstant(
            calendarDayShift(
              firstDay,
              settings.view === "agenda" ? 90 : days.length
            ) + "T00:00",
            zone
          )!
  const dayHours = (day: string) =>
    (zonedInstant(calendarDayShift(day, 1) + "T00:00", zone)! -
      zonedInstant(day + "T00:00", zone)!) /
    3600000
  const axisHours = Math.max(24, ...days.map(dayHours))
  const projectIds = new Set(
    sources?.sidebar?.items.flatMap((p) =>
      p.type === "folder" && p.id === settings.project ? p.boardIds : []
    ) ?? []
  )
  const items = useMemo(() => {
    const list: DisplayOccurrence[] = state.events
      .filter(
        (e) =>
          activeIds.has(e.calendarId) &&
          (!settings.project ||
            e.links.some(
              (l) =>
                (l.type === "project" && l.id === settings.project) ||
                (sources &&
                  projectIds.has(
                    calendarSource(l, sources, state).boardId ?? ""
                  ))
            ))
      )
      .flatMap((e) =>
        calendarOccurrences(
          e,
          from - 2 * 86400000,
          to + 2 * 86400000,
          10000,
          settings.status === "all" || settings.status === "cancelled"
        )
      )
      .map((i) => {
        if (!i.event.allDay) return i
        const first = wallTime(i.start, i.event.timeZone).slice(0, 10),
          last = wallTime(i.end, i.event.timeZone).slice(0, 10)
        return {
          ...i,
          rawStart: i.start,
          rawEnd: i.end,
          start: zonedInstant(first + "T00:00", zone)!,
          end: zonedInstant(last + "T00:00", zone)!,
        }
      })
      .filter(
        (i) =>
          i.start < to &&
          i.end > from &&
          (!settings.query ||
            i.event.title
              .toLocaleLowerCase()
              .includes(settings.query.toLocaleLowerCase())) &&
          (settings.status === "all" ||
            i.event.status ===
              (settings.status === "active" ? "planned" : settings.status))
      )
    if (sources) {
      const accepts = (boardId: string) =>
        activeCalendars.find(
          (c) =>
            c.showDeadlines &&
            (!c.sourceBoardIds.length || c.sourceBoardIds.includes(boardId)) &&
            (!c.workspaceId ||
              sources.dashboards.find((b) => b.id === boardId)?.workspaceId ===
                c.workspaceId)
        )
      const acceptsCard = (
        card: (typeof sources.cards)[number],
        boardId: string
      ) => {
        const board = sources.dashboards.find((b) => b.id === boardId)!
        const assigned = planningCalendarId(calendars, card, board)
        const exact = activeCalendars.find(
          (c) => c.id === assigned && c.showDeadlines
        )
        // A hidden assigned calendar hides its markers too; source scopes are
        // fallback membership only, never a second copy of the same deadline.
        if (assigned !== GENERAL_CALENDAR_ID) return exact
        return (
          exact ??
          activeCalendars.find(
            (c) => c.showDeadlines && cardInCalendar(card, board, c)
          )
        )
      }
      for (const card of sources.cards) {
        const col = sources.columns.find(
            (c) => c.id === card.columnId && !c.deletedAt
          ),
          board = sources.dashboards.find(
            (b) => b.id === col?.dashboardId && !b.deletedAt
          ),
          calendar = board ? acceptsCard(card, board.id) : undefined
        if (
          !calendar ||
          !board ||
          !col ||
          card.deletedAt ||
          card.archived ||
          board.archived ||
          !card.deadline ||
          (settings.status === "active" &&
            isCardCompleted(card, col, board.layout)) ||
          (settings.status === "completed" &&
            !isCardCompleted(card, col, board.layout)) ||
          settings.status === "cancelled" ||
          (settings.project && !projectIds.has(board.id)) ||
          (settings.query &&
            !card.title.toLowerCase().includes(settings.query.toLowerCase()))
        )
          continue
        const at = deadlineInstant(card.deadline)
        if (at < from || at >= to) continue
        const event = {
          ...eventDefaults(calendar.id, new Date(at), card.title),
          id: "deadline_" + card.id,
          status: isCardCompleted(card, col, board.layout)
            ? ("completed" as const)
            : ("planned" as const),
          start: new Date(at).toISOString(),
          end: new Date(at + 60000).toISOString(),
          allDay: card.deadline.length === 10,
          links: [{ type: "card" as const, id: card.id }],
        }
        list.push({
          key: event.id,
          seriesId: event.id,
          day: wallTime(at, zone).slice(0, 10),
          start: at,
          end: at + 60000,
          event,
          deadline: true,
        })
      }
      const marker = (
        key: string,
        title: string,
        value: string,
        calendar: BordenaCalendar,
        link: ScheduleLink,
        label = "Дедлайн"
      ) => {
        const at = deadlineInstant(value)
        if (
          at < from ||
          at >= to ||
          (settings.query &&
            !title.toLowerCase().includes(settings.query.toLowerCase()))
        )
          return
        const event = {
          ...eventDefaults(calendar.id, new Date(at), title),
          id: key,
          allDay: value.length === 10,
          links: [link],
        }
        list.push({
          key,
          seriesId: key,
          day: wallTime(at, zone).slice(0, 10),
          start: at,
          end: at + 60000,
          event,
          deadline: true,
          marker: label,
        })
      }
      for (const board of sources.dashboards) {
        const calendar = accepts(board.id)
        if (
          calendar &&
          !board.deletedAt &&
          !board.archived &&
          board.deadline &&
          (!settings.project || projectIds.has(board.id))
        )
          marker(
            "deadline_board_" + board.id,
            board.title,
            board.deadline,
            calendar,
            { type: "board", id: board.id }
          )
      }
      for (const project of sources.sidebar?.items ?? [])
        if (
          project.type === "folder" &&
          !project.archived &&
          project.deadline &&
          (!settings.project || project.id === settings.project)
        ) {
          const calendar = activeCalendars.find(
            (c) =>
              c.showDeadlines &&
              (!c.workspaceId ||
                c.workspaceId === (project.workspaceId ?? "default")) &&
              (!c.sourceBoardIds.length ||
                project.boardIds.some((id) => c.sourceBoardIds.includes(id)))
          )
          if (calendar)
            marker(
              "deadline_project_" + project.id,
              project.title,
              project.deadline,
              calendar,
              { type: "project", id: project.id }
            )
        }
      for (const card of sources.cards.filter(
        (c) => !c.deletedAt && !c.archived
      )) {
        const column = sources.columns.find(
            (c) => c.id === card.columnId && !c.deletedAt
          ),
          board = sources.dashboards.find(
            (b) => b.id === column?.dashboardId && !b.deletedAt && !b.archived
          ),
          calendar = board ? acceptsCard(card, board.id) : undefined
        if (
          !board ||
          !calendar ||
          (settings.project && !projectIds.has(board.id))
        )
          continue
        const anchors = [
          ...card.body.matchAll(/\[([^\n]*?)\]\((#bordena-date=[^\s)]+)\)/g),
        ].flatMap((m) => {
          const date = parseInlineDate(m[2])
          return date ? [{ ...date, title: m[1] }] : []
        })
        for (const date of anchors)
          if (anchors.filter((a) => a.id === date.id).length === 1)
            marker(
              `inline_${card.id}_${date.id}`,
              date.title,
              date.value,
              calendar,
              { type: "inline-date", id: date.id, cardId: card.id },
              "Дата в тексте"
            )
      }
    }
    return list.sort((a, b) =>
      settings.view === "agenda" && settings.sort === "title"
        ? a.event.title.localeCompare(b.event.title) || a.start - b.start
        : a.start - b.start || a.key.localeCompare(b.key)
    )
    // Query and period own the derived view; no event is copied into persistent calendars.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state,
    sources,
    selected,
    settings.query,
    settings.project,
    settings.status,
    settings.sort,
    settings.view,
    settings.visibleCalendarIds,
    from,
    to,
  ])
  const detailItem = selectedItem
    ? (items.find((item) => item.key === selectedItem.key) ?? null)
    : null
  const agendaKeys = new Set(items.slice(0, agendaLimit).map((i) => i.key))
  const dayItems = (day: string) => {
    const a = zonedInstant(day + "T00:00", zone)!,
      b = zonedInstant(calendarDayShift(day, 1) + "T00:00", zone)!
    return items.filter((i) =>
      i.deadline
        ? wallTime(i.start, zone).slice(0, 10) === day
        : i.start < b && i.end > a
    )
  }
  const openSource = (link: ScheduleLink) => {
    if (!sources) return
    const target = calendarSource(link, sources, state)
    if (!target.available) {
      setError(
        t("Источник недоступен. Запись сохранена; выберите новую связь.")
      )
      return
    }
    if (link.type === "workspace" || link.type === "project") {
      const folder = sources.sidebar?.items.find(
        (i) => i.type === "folder" && i.id === link.id
      )
      setPreferences({
        workspaceId:
          link.type === "workspace"
            ? link.id
            : folder?.type === "folder"
              ? (folder.workspaceId ?? "default")
              : "default",
        ...(target.archived ? { showArchived: true } : {}),
      })
      if (link.type === "project") setFolderCollapsed(link.id, false)
      changeNavigation((s) => ({ ...s, active: null }))
      navigate("~/")
      return
    }
    if (link.type === "card" || link.cardId) {
      if (link.type === "checklist")
        sessionStorage.setItem(
          "bordena:calendar:focus",
          JSON.stringify({ cardId: link.cardId, id: link.id })
        )
      navigate(`~/d/${target.boardId}/c/${link.cardId ?? link.id}`)
      return
    }
    if (target.boardId) navigate(`~/d/${target.boardId}`)
    else if (link.type === "event") {
      const event = state.events.find((e) => e.id === link.id)
      if (event) setEventEdit({ event })
    }
  }
  const editItem = (item: DisplayOccurrence, intent?: "unschedule") => {
    if (ignoreClick.current) {
      ignoreClick.current = false
      return
    }
    if (item.deadline) {
      openSource(item.event.links[0])
      return
    }
    const original = state.events.find((e) => e.id === item.seriesId)!
    setEventEdit({
      event: item.event.recurrence
        ? {
            ...original,
            ...item.event,
            start: new Date(item.rawStart ?? item.start).toISOString(),
            end: new Date(item.rawEnd ?? item.end).toISOString(),
          }
        : original,
      instance: original.recurrence ? item.day : undefined,
      intent,
    })
  }
  const canReturnToTasks = (event: CalendarEvent) =>
    !!event.updatedAt &&
    event.kind === "block" &&
    event.status === "planned" &&
    event.links.some((link) => {
      if (link.type !== "card") return false
      const card = sources?.cards.find(
          (c) => c.id === link.id && !c.deletedAt && !c.archived
        ),
        column = sources?.columns.find(
          (c) => c.id === card?.columnId && !c.deletedAt
        ),
        board = sources?.dashboards.find(
          (b) => b.id === column?.dashboardId && !b.deletedAt && !b.archived
        )
      return (
        card && column && board && !isCardCompleted(card, column, board.layout)
      )
    })
  const otherPlannedBlocks = (event: CalendarEvent) =>
    state.events.some(
      (other) =>
        other.id !== event.id &&
        !other.deletedAt &&
        hasPlannedWork(other) &&
        other.links.some(
          (link) =>
            link.type === "card" &&
            event.links.some((l) => l.type === "card" && l.id === link.id)
        )
    )
  const returnLabel = (event: CalendarEvent) =>
    event.recurrence
      ? t("Снять планирование")
      : otherPlannedBlocks(event)
        ? t("Снять этот блок с плана")
        : t("Вернуть в незапланированные")
  const returnToTasks = async (event: CalendarEvent) => {
    setReturning(true)
    try {
      await returnCalendarBlockToTasks(event)
      setReleasedCard(event.links.find((l) => l.type === "card")?.id ?? null)
      setSelectedItem(null)
      setSideMode("tasks")
      setTaskPanel(true)
    } finally {
      setReturning(false)
    }
  }
  const openItem = (item: DisplayOccurrence) => {
    if (ignoreClick.current) {
      ignoreClick.current = false
      return
    }
    setFocusDetail(focus)
    setSelectedItem(item)
    setSideMode("details")
    setTaskPanel(true)
  }
  const clickItem = (event: React.MouseEvent, item: DisplayOccurrence) => {
    if (ignoreClick.current) {
      ignoreClick.current = false
      return
    }
    clearTimeout(clickTimer.current)
    if (event.detail === 0) openItem(item)
    else if (event.detail === 1)
      clickTimer.current = setTimeout(() => openItem(item), 220)
  }
  const directEdit = (event: React.MouseEvent, item: DisplayOccurrence) => {
    event.stopPropagation()
    clearTimeout(clickTimer.current)
    editItem(item)
  }
  const eventContext = (event: React.MouseEvent, item: DisplayOccurrence) => {
    event.preventDefault()
    event.stopPropagation()
    clearTimeout(clickTimer.current)
    setContext({ item, x: event.clientX, y: event.clientY })
  }
  const point = (x: number, y: number) => {
    const box = grid.current?.getBoundingClientRect()
    if (!box) return null
    const index = Math.max(
      0,
      Math.min(
        days.length - 1,
        Math.floor(((x - box.x) / box.width) * days.length)
      )
    )
    const minutes = Math.max(
      0,
      Math.min(
        dayHours(days[index]) * 60 - 1,
        Math.round((((y - box.y) / settings.zoom) * 60) / settings.snap) *
          settings.snap
      )
    )
    return zonedInstant(days[index] + "T00:00", zone)! + minutes * 60000
  }
  const finishDrag = async (
    info: DragInfo,
    value: { start: number; end: number }
  ) => {
    if (value.end <= value.start) return
    try {
      if (info.item) {
        const original = state.events.find((e) => e.id === info.item!.seriesId)!
        if (original.recurrence)
          setEventEdit({
            event: {
              ...original,
              start: new Date(value.start).toISOString(),
              end: new Date(value.end).toISOString(),
            },
            instance: info.item.day,
          })
        else
          await saveCalendarEvent({
            ...original,
            start: new Date(value.start).toISOString(),
            end: new Date(value.end).toISOString(),
          })
      } else {
        create(value.start, info.cardId)
        setEventEdit((s) =>
          s
            ? {
                ...s,
                event: { ...s.event, end: new Date(value.end).toISOString() },
              }
            : s
        )
      }
    } catch (e) {
      setError(formatLocalError(e))
    }
  }
  useEffect(() => {
    if (!drag) return
    let latest = { start: drag.start, end: drag.end },
      moved = false
    const move = (e: PointerEvent) => {
      if (
        Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) <
          5 &&
        !moved
      )
        return
      moved = true
      ignoreClick.current = true
      const at = point(e.clientX, e.clientY)
      if (at === null) return
      latest = drag.resize
        ? {
            start: drag.start,
            end: Math.max(drag.start + settings.snap * 60000, at),
          }
        : {
            start:
              drag.start + at - (point(drag.startX, drag.startY) ?? drag.start),
            end:
              drag.end + at - (point(drag.startX, drag.startY) ?? drag.start),
          }
      setPreview(latest)
    }
    const up = () => {
      setDrag(null)
      setPreview(null)
      if (moved) void finishDrag(drag, latest)
      else if (!drag.item) create(drag.start)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up, { once: true })
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    // Snapshot the gesture; subsequent pointer events own preview until commit or Esc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag])
  useEffect(() => {
    if (weekScroll.current)
      weekScroll.current.scrollTop =
        settings.view === "day" || settings.view === "week"
          ? settings.zoom * 7
          : 0
  }, [settings.view, settings.zoom, firstDay])
  useEffect(() => {
    const dispose = [
      settings.view === "month" ? null : weekScroll.current,
      taskScroll.current,
    ]
      .filter((element): element is HTMLElement => element !== null)
      .map(installSmoothWheel)
    return () => dispose.forEach((stop) => stop())
  }, [hasCalendars, taskPanel, settings.view, settings.zoom, firstDay])
  useEffect(() => {
    if (settings.view !== "month" || !weekScroll.current) return
    return installMonthWheel(weekScroll.current, (direction) =>
      setSettings((s) => ({ ...s, date: shiftMonth(s.date, direction) }))
    )
  }, [hasCalendars, settings.view])
  const color = (item: DisplayOccurrence) =>
    state.calendars.find((c) => c.id === item.event.calendarId)?.color ??
    "#7866d5"
  const itemLabel = (item: DisplayOccurrence) =>
    `${item.deadline ? t(item.marker ?? "Дедлайн") : item.event.kind === "block" ? t("Рабочий блок") : t("Событие")}: ${item.event.title} · ${wallTime(item.start, zone).slice(11)}–${wallTime(item.end, zone).slice(11)} · ${state.calendars.find((c) => c.id === item.event.calendarId)?.title ?? ""}`
  const unscheduled = (sources?.cards ?? [])
    .filter((card) => {
      const col = sources?.columns.find(
          (c) => c.id === card.columnId && !c.deletedAt
        ),
        board = sources?.dashboards.find(
          (b) => b.id === col?.dashboardId && !b.deletedAt
        )
      return (
        board &&
        col &&
        !board.archived &&
        !card.deletedAt &&
        !card.archived &&
        (!settings.taskPriority ||
          card.id === revealedCard ||
          (card.priority || "none") === settings.taskPriority) &&
        (card.id === revealedCard ||
          activeIds.has(planningCalendarId(calendars, card, board)) ||
          (!card.calendarId &&
            !board.defaultCalendarId &&
            activeCalendars.some(
              (c) =>
                c.id !== GENERAL_CALENDAR_ID && cardInCalendar(card, board, c)
            ))) &&
        !isCardCompleted(card, col, board.layout) &&
        !state.events.some(
          (e) =>
            !e.deletedAt &&
            hasPlannedWork(e) &&
            e.links.some((l) => l.type === "card" && l.id === card.id)
        ) &&
        (card.id === revealedCard ||
          !settings.query ||
          card.title.toLowerCase().includes(settings.query.toLowerCase())) &&
        (card.id === revealedCard ||
          !settings.project ||
          projectIds.has(board.id))
      )
    })
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2, "": 3 })[
          a.priority as "high" | "medium" | "low" | ""
        ] -
          { high: 0, medium: 1, low: 2, "": 3 }[
            b.priority as "high" | "medium" | "low" | ""
          ] ||
        (a.deadline ? deadlineInstant(a.deadline) : Infinity) -
          (b.deadline ? deadlineInstant(b.deadline) : Infinity) ||
        a.id.localeCompare(b.id)
    )
  const needsPlanning = state.events.filter(
    (e) =>
      activeIds.has(e.calendarId) &&
      !e.deletedAt &&
      e.status === "planned" &&
      e.execution?.result === "needs-planning"
  )
  const planTask = async (id: string, at: number) => {
    if (!unscheduled.some((c) => c.id === id) || pendingTasks.current.has(id))
      return
    const event = draftEvent(at, id)
    if (!event) return
    pendingTasks.current.add(id)
    try {
      await saveCalendarEvent(event)
    } catch (e) {
      pendingTasks.current.delete(id)
      setError(formatLocalError(e))
    }
  }
  useEffect(() => {
    for (const id of pendingTasks.current)
      if (!unscheduled.some((c) => c.id === id)) pendingTasks.current.delete(id)
  }, [unscheduled])
  const acceptTask = (e: React.DragEvent) => {
    if (
      !e.dataTransfer.types.includes("bordena/card") &&
      !e.dataTransfer.types.includes("bordena/event")
    )
      return false
    e.preventDefault()
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes("bordena/event")
      ? "move"
      : "copy"
    return true
  }
  const dropOnDay = (e: React.DragEvent, day: string) => {
    if (!acceptTask(e)) return
    e.stopPropagation()
    setPreview(null)
    if (e.dataTransfer.types.includes("bordena/event")) {
      const item = draggedEvent(e)
      if (item) void moveExisting(item, day)
      setNativeDrag(null)
      return
    }
    const at = zonedInstant(day + "T10:00", zone)
    if (at !== null) void planTask(e.dataTransfer.getData("bordena/card"), at)
  }
  const draggedEvent = (e: React.DragEvent) =>
    nativeDrag?.key === e.dataTransfer.getData("bordena/event")
      ? nativeDrag
      : items.find((i) => i.key === e.dataTransfer.getData("bordena/event"))
  const eventDragProps = (item: DisplayOccurrence) => ({
    draggable: !item.deadline && item.event.status === "planned",
    "data-calendar-event": item.seriesId,
    onDragStart: (e: React.DragEvent) => {
      if (item.deadline || item.event.status !== "planned") {
        e.preventDefault()
        return
      }
      clearTimeout(clickTimer.current)
      ignoreClick.current = true
      setDrag(null)
      setNativeDrag(item)
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("bordena/event", item.key)
    },
    onDragEnd: () => {
      setNativeDrag(null)
      setPreview(null)
      setDropTasks(false)
      clearTimeout(hoverNavigation.current)
    },
  })
  const moveExisting = async (
    item: DisplayOccurrence,
    day: string,
    at?: number
  ) => {
    const original = state.events.find((e) => e.id === item.seriesId)
    if (!original || original.updatedAt !== item.event.updatedAt) {
      setError(t("Запись изменена в другом окне. Откройте её заново."))
      return
    }
    try {
      const occurrence = {
        ...original,
        ...item.event,
        start: new Date(item.rawStart ?? item.start).toISOString(),
        end: new Date(item.rawEnd ?? item.end).toISOString(),
      }
      const moved =
        at === undefined || original.allDay
          ? calendarEventOnDate(occurrence, day, zone)
          : {
              ...occurrence,
              start: new Date(at).toISOString(),
              end: new Date(at + item.end - item.start).toISOString(),
            }
      if (original.recurrence) {
        setEventEdit({ event: moved, instance: item.day })
        return
      }
      await saveCalendarEvent(moved)
    } catch (e) {
      setError(formatLocalError(e))
    }
  }
  const dropBack = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("bordena/event")) return
    e.preventDefault()
    e.stopPropagation()
    const item = draggedEvent(e)
    setNativeDrag(null)
    setDropTasks(false)
    setPreview(null)
    if (!item || !canReturnToTasks(item.event)) return
    const event = state.events.find((x) => x.id === item.seriesId)
    if (!event || event.updatedAt !== item.event.updatedAt) {
      setError(t("Запись изменена в другом окне. Откройте её заново."))
      return
    }
    if (event.recurrence) {
      ignoreClick.current = false
      editItem(item, "unschedule")
    } else void returnToTasks(event).catch((e) => setError(formatLocalError(e)))
  }
  const dragBackOver = (e: React.DragEvent) => {
    if (
      nativeDrag &&
      canReturnToTasks(nativeDrag.event) &&
      e.dataTransfer.types.includes("bordena/event")
    ) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDropTasks(true)
    }
  }
  const navigateDrag = (e: React.DragEvent, direction: number) => {
    if (
      !e.dataTransfer.types.some(
        (x) => x === "bordena/event" || x === "bordena/card"
      )
    )
      return
    e.preventDefault()
    if (hoverNavigation.current) return
    hoverNavigation.current = setTimeout(() => {
      cycleDate(direction)
      hoverNavigation.current = undefined
    }, 650)
  }
  const cycleDate = (direction: number) =>
    patch({
      date: shiftCalendarPeriod(settings.date, settings.view, direction),
    })
  const periodLabel = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    ...(settings.view === "year" ? {} : { month: "long" as const }),
    ...(settings.view === "day" ? { day: "numeric" as const } : {}),
  }).format(new Date(settings.date + "T12:00:00"))
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      data-calendar-view={settings.view}
    >
      <header className="bordena-calendar-header flex min-w-0 flex-wrap items-center gap-2 border-b px-4 py-4">
        <SidebarTrigger />
        <FocusExit />
        <div className="flex items-center rounded-lg border bg-muted/30">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("Предыдущий период")}
            onClick={() => cycleDate(-1)}
            onDragOver={(e) => navigateDrag(e, -1)}
            onDragLeave={() => {
              clearTimeout(hoverNavigation.current)
              hoverNavigation.current = undefined
            }}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => patch({ date: today() })}
          >
            {t("Сегодня")}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("Следующий период")}
            onClick={() => cycleDate(1)}
            onDragOver={(e) => navigateDrag(e, 1)}
            onDragLeave={() => {
              clearTimeout(hoverNavigation.current)
              hoverNavigation.current = undefined
            }}
          >
            <ChevronRight />
          </Button>
        </div>
        <h1
          className="min-w-0 flex-1 truncate px-2 text-xl font-semibold"
          title={periodLabel}
        >
          {periodLabel}
        </h1>
        <ViewSwitcher
          label="Представление календаря"
          value={settings.view}
          options={[
            { value: "day", label: "День" },
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
            { value: "agenda", label: "Список" },
            { value: "year", label: "Год" },
          ]}
          onChange={(view) => patch({ view: view as View })}
        />
        <DateInput
          value={settings.date}
          onChange={(date) => date && patch({ date })}
          inputProps={{ "aria-label": t("Перейти к дате") }}
        >
          <span className="p-2">
            <CalendarDays className="size-4" />
          </span>
        </DateInput>
        <Button onClick={() => create()}>
          <Plus />
          {t("Создать событие")}
        </Button>
      </header>
      <div className="bordena-calendar-filters flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm">
        <CalendarPicker
          calendars={calendars}
          selected={selected}
          onSelect={setSelected}
          onVisibility={(id, visible) =>
            patch({
              visibleCalendarIds:
                id === GENERAL_CALENDAR_ID
                  ? visible
                    ? calendars.map((c) => c.id)
                    : []
                  : calendars
                      .filter((c) => (c.id === id ? visible : c.visible))
                      .map((c) => c.id),
            })
          }
          onEdit={(c) =>
            setCalendarEdit(state.calendars.find((x) => x.id === c.id)!)
          }
          onCreate={() =>
            setCalendarEdit(
              calendarDefaults(t("Новый календарь"), calendars.length)
            )
          }
        />
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={taskPanel && sideMode === "filters"}
          onClick={() => {
            setFocus(false)
            setSideMode("filters")
            setTaskPanel(true)
          }}
        >
          <SlidersHorizontal />
          {t("Фильтры")}
          {(settings.query ||
            settings.project ||
            settings.status !== "active") && (
            <span className="rounded bg-primary/20 px-1">
              {
                [
                  settings.query,
                  settings.project,
                  settings.status !== "active",
                ].filter(Boolean).length
              }
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={taskPanel}
          aria-controls="calendar-unscheduled-tasks"
          data-calendar-panel-toggle
          aria-label={t("Правая панель календаря")}
          onClick={() => {
            setFocus(false)
            setTaskPanel((v) => !v)
          }}
        >
          <PanelRight /> {t("Панель")}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Параметры календаря")}
          onClick={() => setAdvanced(true)}
        >
          <MoreHorizontal />
        </Button>
      </div>
      {nativeDrag &&
        canReturnToTasks(nativeDrag.event) &&
        (!taskPanel || focus) && (
          <div
            className="absolute right-4 bottom-4 z-50 rounded-xl border border-dashed border-primary bg-background p-4 text-sm shadow-xl"
            data-unschedule-target={dropTasks || undefined}
            onDragOver={(e) => {
              dragBackOver(e)
              setTaskPanel(true)
              setSideMode("tasks")
              setFocusDetail(true)
            }}
            onDrop={dropBack}
          >
            {returnLabel(nativeDrag.event)}
          </div>
        )}
      {releasedCard && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
        >
          <span>{t("Планирование снято. Исходная карточка сохранена.")}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (
                state.events.some(
                  (e) =>
                    hasPlannedWork(e) &&
                    e.links.some(
                      (l) => l.type === "card" && l.id === releasedCard
                    )
                )
              )
                openSource({ type: "card", id: releasedCard })
              else {
                setRevealedCard(releasedCard)
                setTaskPanel(true)
                setSideMode("tasks")
                setFocus(false)
              }
            }}
          >
            {t("Показать задачу")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReleasedCard(null)
              setRevealedCard(null)
            }}
          >
            ×
          </Button>
          {revealedCard && (
            <span>
              {t(
                "Выбранная задача показана без изменения сохранённых фильтров."
              )}
            </span>
          )}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b p-2 text-xs text-destructive"
        >
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError("")}>
            ×
          </Button>
        </div>
      )}
      {!calendars.length ? (
        <div className="m-auto max-w-md space-y-3 p-6 text-center">
          <CalendarDays className="mx-auto size-10 text-primary" />
          <h2 className="text-xl">{t("Ваше расписание в Bordena")}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "Создайте календарь для проектов или личных дел. Дедлайны остаются сроками, рабочие блоки — вашим планом."
            )}
          </p>
          <Button
            onClick={() =>
              setCalendarEdit(calendarDefaults(t("Новый календарь")))
            }
          >
            {t("Добавить календарь")}
          </Button>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <main
            className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
            ref={weekScroll}
            data-calendar-scroll="timeline"
          >
            {settings.view === "year" ? (
              <CalendarYearView
                year={Number(settings.date.slice(0, 4))}
                zone={zone}
                weekStart={settings.weekStart}
                items={items}
                calendars={calendars}
                onMonth={(date) => patch({ view: "month", date })}
                onDay={(date) => patch({ view: "day", date })}
              />
            ) : settings.view === "month" ? (
              <div
                key={firstDay}
                className="calendar-month-grid grid h-full min-h-80 grid-cols-7"
                style={{
                  minWidth: 420,
                  gridTemplateRows: `36px repeat(${days.length / 7},minmax(60px,1fr))`,
                }}
              >
                <div className="bordena-weekdays col-span-7 grid grid-cols-7 border-b bg-background text-center text-sm text-muted-foreground">
                  {days.slice(0, 7).map((day) => (
                    <span key={day} className="py-2">
                      {new Intl.DateTimeFormat(locale, {
                        weekday: "short",
                      }).format(new Date(day + "T12:00"))}
                    </span>
                  ))}
                </div>
                {days.map((day) => (
                  <div
                    key={day}
                    data-calendar-day={day}
                    data-other-month={
                      day.slice(0, 7) !== settings.date.slice(0, 7)
                    }
                    className="bordena-month-day relative min-w-0 overflow-hidden border-r border-b p-3"
                    data-today={day === today() || undefined}
                    onDragOver={(e) => {
                      if (acceptTask(e))
                        e.currentTarget.dataset.dropTarget = "true"
                    }}
                    onDragLeave={(e) => {
                      delete e.currentTarget.dataset.dropTarget
                    }}
                    onDrop={(e) => {
                      delete e.currentTarget.dataset.dropTarget
                      dropOnDay(e, day)
                    }}
                    onDoubleClick={() =>
                      create(zonedInstant(day + "T10:00", zone) ?? undefined)
                    }
                    onContextMenu={(e) => {
                      e.preventDefault()
                      create(zonedInstant(day + "T10:00", zone) ?? undefined)
                    }}
                  >
                    <button
                      className={`mb-1 rounded px-1 text-xs focus-visible:outline-2 ${day === today() ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      onClick={() => {
                        setMoreDay(day)
                      }}
                    >
                      {new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                      }).format(new Date(day + "T12:00"))}
                    </button>
                    {dayItems(day)
                      .slice(0, monthLimit)
                      .map((i) => (
                        <button
                          key={i.key}
                          {...eventDragProps(i)}
                          className="bordena-calendar-event mb-2 block w-full truncate rounded-lg border-l-[3px] bg-muted/50 text-left text-sm focus-visible:outline-2"
                          style={{
                            borderLeftColor: color(i),
                            backgroundColor: `color-mix(in srgb,${color(i)} 20%,transparent)`,
                          }}
                          title={itemLabel(i)}
                          onContextMenu={(e) => eventContext(e, i)}
                          onDoubleClick={(event) => directEdit(event, i)}
                          onClick={(event) => clickItem(event, i)}
                        >
                          {i.deadline
                            ? "◆"
                            : i.event.kind === "block"
                              ? "▰"
                              : "●"}{" "}
                          {i.event.title}
                          <span className="bordena-event-time block text-xs text-muted-foreground">
                            {i.event.allDay
                              ? t("Весь день")
                              : wallTime(i.start, zone).slice(11) +
                                "–" +
                                wallTime(i.end, zone).slice(11)}
                          </span>
                        </button>
                      ))}
                    {dayItems(day).length > monthLimit && (
                      <button
                        className="text-xs text-primary"
                        onClick={() => setMoreDay(day)}
                      >
                        {t("Ещё {count}", {
                          count: dayItems(day).length - monthLimit,
                        })}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : settings.view === "agenda" ? (
              <div className="space-y-5 p-4">
                {[
                  ...new Set(
                    items
                      .slice(0, agendaLimit)
                      .map((i) => wallTime(i.start, zone).slice(0, 10))
                  ),
                ]
                  .sort()
                  .map((day) => (
                    <section
                      key={day}
                      data-calendar-day={day}
                      onDragOver={acceptTask}
                      onDrop={(e) => dropOnDay(e, day)}
                    >
                      <h2 className="mb-2 text-sm font-semibold">
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "full",
                        }).format(new Date(day + "T12:00"))}
                      </h2>
                      {dayItems(day)
                        .filter(
                          (i) =>
                            agendaKeys.has(i.key) &&
                            wallTime(i.start, zone).slice(0, 10) === day
                        )
                        .map((i) => (
                          <button
                            {...eventDragProps(i)}
                            key={i.key}
                            onClick={() => openItem(i)}
                            className="mb-2 flex w-full items-center gap-3 rounded-lg border-l-4 bg-muted/40 p-3 text-left text-sm focus-visible:outline-2"
                            style={{ borderLeftColor: color(i) }}
                          >
                            <span>
                              {i.deadline
                                ? "◆"
                                : i.event.kind === "block"
                                  ? "▰"
                                  : "●"}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {i.event.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {i.event.allDay
                                ? t("Весь день")
                                : wallTime(i.start, zone).slice(11) +
                                  "–" +
                                  wallTime(i.end, zone).slice(11)}
                            </span>
                          </button>
                        ))}
                    </section>
                  ))}
                {items.length > agendaLimit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAgendaLimit((n) => n + 300)}
                  >
                    {t("Показать ещё")}
                  </Button>
                )}
                {!items.length && (
                  <p className="p-6 text-sm text-muted-foreground">
                    {t("На этот период событий нет.")}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ minWidth: settings.view === "week" ? 980 : 320 }}>
                <div
                  className="sticky top-0 z-20 grid border-b bg-background"
                  style={{
                    gridTemplateColumns: `48px repeat(${days.length},minmax(0,1fr))`,
                  }}
                >
                  <div />
                  <>
                    {days.map((day) => (
                      <div
                        key={day}
                        data-calendar-drop-day={day}
                        onDragOver={acceptTask}
                        onDrop={(e) => dropOnDay(e, day)}
                        className="border-l p-2 text-center text-xs"
                      >
                        <button
                          className={
                            day === today()
                              ? "rounded bg-primary px-2 text-primary-foreground"
                              : ""
                          }
                          onClick={() => patch({ date: day, view: "day" })}
                        >
                          {new Intl.DateTimeFormat(locale, {
                            day: "numeric",
                            weekday: "short",
                          }).format(new Date(day + "T12:00"))}
                        </button>
                        {dayItems(day)
                          .filter((i) => i.event.allDay || i.deadline)
                          .slice(0, 4)
                          .map((i) => (
                            <button
                              key={i.key}
                              {...eventDragProps(i)}
                              onClick={() => openItem(i)}
                              title={itemLabel(i)}
                              className="mt-1 block w-full truncate rounded border-l-2 bg-muted/50 px-1 text-left"
                              style={{ borderLeftColor: color(i) }}
                            >
                              {i.deadline ? "◆" : "●"} {i.event.title}
                            </button>
                          ))}
                      </div>
                    ))}
                  </>
                </div>
                <div className="flex">
                  <div
                    className="w-12 shrink-0"
                    style={{ height: axisHours * settings.zoom }}
                  >
                    {Array.from({ length: axisHours }, (_, h) => (
                      <div
                        key={h}
                        style={{ height: settings.zoom }}
                        className="pr-1 text-right text-[10px] text-muted-foreground"
                      >
                        {h < dayHours(firstDay)
                          ? wallTime(from + h * 3600000, zone).slice(11)
                          : ""}
                      </div>
                    ))}
                  </div>
                  <div
                    ref={grid}
                    className="relative grid flex-1"
                    style={{
                      height: axisHours * settings.zoom,
                      gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`,
                    }}
                    onPointerDown={(e) => {
                      if (
                        e.button !== 0 ||
                        (e.target as HTMLElement).closest("button")
                      )
                        return
                      const at = point(e.clientX, e.clientY)
                      if (at !== null) {
                        ignoreClick.current = false
                        setDrag({
                          startX: e.clientX,
                          startY: e.clientY,
                          start: at,
                          end: at + settings.snap * 60000,
                          resize: true,
                        })
                      }
                    }}
                    onDragOver={(e) => {
                      if (
                        e.dataTransfer.types.includes("bordena/card") ||
                        e.dataTransfer.types.includes("bordena/event")
                      ) {
                        e.preventDefault()
                        const at = point(e.clientX, e.clientY)
                        if (at !== null)
                          setPreview({ start: at, end: at + estimate * 60000 })
                      }
                    }}
                    onDrop={(e) => {
                      if (!acceptTask(e)) return
                      const id = e.dataTransfer.getData("bordena/card"),
                        at = point(e.clientX, e.clientY)
                      setPreview(null)
                      if (e.dataTransfer.types.includes("bordena/event")) {
                        const item = draggedEvent(e)
                        if (item && at !== null)
                          void moveExisting(
                            item,
                            wallTime(at, zone).slice(0, 10),
                            at
                          )
                        setNativeDrag(null)
                      } else if (id && at !== null) void planTask(id, at)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      const at = point(e.clientX, e.clientY)
                      if (at !== null) create(at)
                    }}
                  >
                    {days.map((day) => {
                      const start = zonedInstant(day + "T00:00", zone)!,
                        end = zonedInstant(
                          calendarDayShift(day, 1) + "T00:00",
                          zone
                        )!
                      const timed = dayItems(day)
                          .filter((i) => !i.event.allDay && !i.deadline)
                          .map((i) => ({
                            ...i,
                            start: Math.max(i.start, start),
                            end: Math.min(i.end, end),
                          })),
                        placed = layoutIntervals(timed)
                      return (
                        <div
                          key={day}
                          data-calendar-day={day}
                          className="relative border-l"
                          style={{
                            backgroundImage:
                              "linear-gradient(to bottom,var(--border) 1px,transparent 1px)",
                            backgroundSize: `100% ${settings.zoom}px`,
                          }}
                        >
                          {dayHours(day) !== 24 &&
                            Array.from(
                              { length: Math.ceil(dayHours(day)) },
                              (_, h) => (
                                <span
                                  key={h}
                                  className="pointer-events-none absolute left-0 z-10 rounded bg-background px-1 text-[9px] text-muted-foreground"
                                  style={{ top: h * settings.zoom }}
                                >
                                  {wallTime(start + h * 3600000, zone).slice(
                                    11
                                  )}
                                </span>
                              )
                            )}
                          {placed
                            .filter((i) => i.columns <= 4 || i.column < 3)
                            .map((i) => (
                              <button
                                key={i.key}
                                aria-label={itemLabel(i)}
                                title={itemLabel(i)}
                                className={`absolute overflow-hidden rounded border-l-3 p-1 text-left text-xs leading-tight focus-visible:z-30 focus-visible:outline-2 ${i.event.status === "completed" ? "opacity-60" : ""}`}
                                style={{
                                  top:
                                    ((i.start - start) / 3600000) *
                                    settings.zoom,
                                  height: Math.max(
                                    3,
                                    ((i.end - i.start) / 3600000) *
                                      settings.zoom
                                  ),
                                  left: `${(i.column / Math.min(i.columns, 4)) * 100}%`,
                                  width: `${100 / Math.min(i.columns, 4)}%`,
                                  backgroundColor: `color-mix(in srgb,${color(i)} 24%,var(--background))`,
                                  borderColor: color(i),
                                }}
                                {...eventDragProps(i)}
                                onContextMenu={(e) => eventContext(e, i)}
                                onDoubleClick={(event) => directEdit(event, i)}
                                onClick={(event) => clickItem(event, i)}
                              >
                                <span>
                                  {i.event.kind === "block" ? "▰" : "●"}{" "}
                                  {i.event.title}
                                </span>
                                <span className="block text-[10px] opacity-75">
                                  {wallTime(i.start, zone).slice(11)}–
                                  {wallTime(i.end, zone).slice(11)}
                                </span>
                                <span
                                  aria-label={t("Изменить длительность")}
                                  className="absolute right-0 bottom-0 left-0 h-2 cursor-ns-resize"
                                  onPointerDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    ignoreClick.current = false
                                    setDrag({
                                      item: items.find(
                                        (original) => original.key === i.key
                                      )!,
                                      resize: true,
                                      startX: e.clientX,
                                      startY: e.clientY,
                                      start: items.find(
                                        (original) => original.key === i.key
                                      )!.start,
                                      end: items.find(
                                        (original) => original.key === i.key
                                      )!.end,
                                    })
                                  }}
                                />
                              </button>
                            ))}
                          {placed.some(
                            (i) => i.columns > 4 && i.column >= 3
                          ) && (
                            <button
                              className="absolute left-3/4 z-20 w-1/4 rounded border bg-muted p-1 text-xs focus-visible:outline-2"
                              style={{
                                top:
                                  ((placed.find(
                                    (i) => i.columns > 4 && i.column >= 3
                                  )!.start -
                                    start) /
                                    3600000) *
                                  settings.zoom,
                              }}
                              onClick={() => setMoreDay(day)}
                            >
                              {t("Ещё {count}", {
                                count: placed.filter(
                                  (i) => i.columns > 4 && i.column >= 3
                                ).length,
                              })}
                            </button>
                          )}
                          {day === today() && (
                            <div
                              aria-label={t("Сейчас")}
                              className="pointer-events-none absolute right-0 left-0 z-20 border-t border-red-500"
                              style={{
                                top: ((now - start) / 3600000) * settings.zoom,
                              }}
                            />
                          )}
                          {preview &&
                            wallTime(preview.start, zone).startsWith(day) && (
                              <div
                                className="pointer-events-none absolute right-0 left-0 z-30 rounded border-2 border-dashed border-primary bg-primary/20 p-1 text-xs"
                                style={{
                                  top:
                                    ((preview.start - start) / 3600000) *
                                    settings.zoom,
                                  height: Math.max(
                                    12,
                                    ((preview.end - preview.start) / 3600000) *
                                      settings.zoom
                                  ),
                                }}
                              >
                                {wallTime(preview.start, zone).slice(11)}–
                                {wallTime(preview.end, zone).slice(11)}
                                {items.some(
                                  (i) =>
                                    i.key !== drag?.item?.key &&
                                    i.start < preview.end &&
                                    i.end > preview.start
                                )
                                  ? " · " + t("Пересечение")
                                  : ""}
                              </div>
                            )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </main>
          {taskPanel && (!focus || focusDetail) && (
            <aside
              id="calendar-unscheduled-tasks"
              ref={taskScroll}
              data-calendar-scroll="tasks"
              data-unschedule-target={dropTasks || undefined}
              onDragOver={dragBackOver}
              onDrop={dropBack}
              onDragLeave={() => setDropTasks(false)}
              aria-label={t("Правая панель календаря")}
              className={`bordena-calendar-panel w-80 shrink-0 overflow-auto border-l bg-background p-4 ${focus ? "absolute inset-y-0 right-0 z-40 shadow-xl" : ""}`}
            >
              <div className="bordena-calendar-panel-tabs sticky top-0 z-30 mb-5 flex items-center gap-1 border-b bg-background pb-3">
                {(["tasks", "details", "filters"] as const).map((mode) => (
                  <button
                    key={mode}
                    className="rounded-md px-2 py-1.5 text-sm aria-pressed:bg-primary/20"
                    aria-pressed={sideMode === mode}
                    onClick={() => setSideMode(mode)}
                  >
                    {t(
                      mode === "tasks"
                        ? "Задачи"
                        : mode === "details"
                          ? "Детали"
                          : "Фильтры"
                    )}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={t("Скрыть список задач")}
                  onClick={() => setTaskPanel(false)}
                >
                  <X />
                </Button>
              </div>
              {sideMode === "tasks" && (
                <div className="space-y-3">
                  {nativeDrag && canReturnToTasks(nativeDrag.event) && (
                    <p
                      role="status"
                      className="rounded-lg border border-dashed border-primary p-3 text-sm"
                    >
                      {returnLabel(nativeDrag.event)}
                    </p>
                  )}
                  <h2 className="text-base font-semibold">
                    {t("Незапланированные задачи")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Используется сортировка задач по приоритету. При равном приоритете — по сроку и стабильному ID."
                    )}
                  </p>
                  <label className="block text-xs">
                    {t("Приоритет задач")}
                    <select
                      aria-label={t("Приоритет задач")}
                      className="ml-2 rounded border bg-background p-1"
                      value={settings.taskPriority ?? ""}
                      onChange={(e) => patch({ taskPriority: e.target.value })}
                    >
                      <option value="">{t("Все")}</option>
                      <option value="high">{t("Высокий")}</option>
                      <option value="medium">{t("Средний")}</option>
                      <option value="low">{t("Низкий")}</option>
                      <option value="none">{t("Без приоритета")}</option>
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Перетащите задачу на дату или нажмите, чтобы выбрать время."
                    )}
                  </p>
                  <label className="block text-xs">
                    {t("Длительность, минут")}
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={estimate}
                      onChange={(e) => {
                        const value = e.target.valueAsNumber
                        if (Number.isFinite(value))
                          setEstimate(Math.max(5, Math.min(1440, value)))
                      }}
                      className="ml-2 w-16 rounded border bg-background p-1"
                    />
                  </label>
                  {unscheduled.slice(0, 200).map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      data-calendar-task={card.id}
                      title={card.title || t("Без названия")}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "copy"
                        e.dataTransfer.setData("bordena/card", card.id)
                      }}
                      onDragEnd={() => {
                        setPreview(null)
                        weekScroll.current
                          ?.querySelectorAll("[data-drop-target]")
                          .forEach((el) =>
                            el.removeAttribute("data-drop-target")
                          )
                      }}
                      className="bordena-planning-task block w-full min-w-0 cursor-grab rounded-lg border p-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-2 active:cursor-grabbing"
                      onClick={() => create(undefined, card.id)}
                    >
                      <span className="mb-2 block font-medium break-words">
                        {card.title || t("Без названия")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {card.deadline &&
                        Number.isFinite(deadlineInstant(card.deadline))
                          ? new Intl.DateTimeFormat(locale, {
                              dateStyle: "short",
                              ...(card.deadline.includes("T")
                                ? { timeStyle: "short" as const }
                                : {}),
                            }).format(new Date(deadlineInstant(card.deadline)))
                          : t("Без срока")}{" "}
                        ·{" "}
                        {t(
                          card.priority === "high"
                            ? "Высокий"
                            : card.priority === "low"
                              ? "Низкий"
                              : card.priority === "medium"
                                ? "Средний"
                                : "Без приоритета"
                        )}
                      </span>
                    </button>
                  ))}
                  {!unscheduled.length && (
                    <p className="text-xs text-muted-foreground">
                      {t("Все задачи запланированы.")}
                    </p>
                  )}
                  {unscheduled.length > 200 && (
                    <p className="text-xs">
                      {t("Уточните поиск для остальных задач.")}
                    </p>
                  )}
                  {!!needsPlanning.length && (
                    <h2 className="pt-3 text-sm font-semibold">
                      {t("Требуется планирование")}
                    </h2>
                  )}
                  {needsPlanning.map((e) => (
                    <button
                      key={e.id}
                      className="block text-left text-xs text-destructive"
                      onClick={() => setEventEdit({ event: e })}
                    >
                      {e.title} · {t("Нет свободного времени")}
                    </button>
                  ))}
                </div>
              )}
              {sideMode === "filters" && (
                <div className="space-y-4 text-sm">
                  <h2 className="font-semibold">{t("Фильтры календаря")}</h2>{" "}
                  <input
                    type="search"
                    placeholder={t("Поиск в календаре")}
                    aria-label={t("Поиск в календаре")}
                    value={settings.query}
                    onChange={(e) => patch({ query: e.target.value })}
                    className="min-w-24 flex-1 rounded border bg-background p-1"
                  />
                  <select
                    aria-label={t("Проект")}
                    value={settings.project}
                    onChange={(e) => patch({ project: e.target.value })}
                    className="max-w-40 rounded border bg-background p-1"
                  >
                    <option value="">{t("Все проекты")}</option>
                    {sources?.sidebar?.items.flatMap((p) =>
                      p.type === "folder"
                        ? [
                            <option value={p.id} key={p.id}>
                              {p.title}
                            </option>,
                          ]
                        : []
                    )}
                  </select>
                  <label className="block">
                    {t("Состояние")}
                    <select
                      aria-label={t("Состояние")}
                      value={settings.status}
                      onChange={(e) => patch({ status: e.target.value })}
                      className="ml-2 rounded border bg-background p-1"
                    >
                      <option value="active">{t("Активные")}</option>
                      <option value="all">{t("Все")}</option>
                      <option value="completed">{t("Выполнено")}</option>
                      <option value="cancelled">{t("Отменено")}</option>
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t("Активные фильтры ограничивают видимые события.")}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      patch({ query: "", project: "", status: "active" })
                    }
                  >
                    {t("Сбросить фильтры")}
                  </Button>
                </div>
              )}
              {sideMode === "details" &&
                (detailItem ? (
                  <div className="space-y-4">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: color(detailItem) }}
                    />
                    <h2 className="text-lg font-semibold break-words">
                      {detailItem.event.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(detailItem.start)}{" "}
                      –{" "}
                      {new Intl.DateTimeFormat(locale, {
                        timeStyle: "short",
                      }).format(detailItem.end)}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {detailItem.event.description}
                    </p>
                    {!detailItem.deadline && (
                      <Button onClick={() => editItem(detailItem)}>
                        <Pencil />
                        {t("Редактировать событие")}
                      </Button>
                    )}
                    {!detailItem.deadline &&
                      canReturnToTasks(detailItem.event) && (
                        <div className="space-y-2">
                          <Button
                            variant="secondary"
                            disabled={returning}
                            onClick={() => {
                              const event = state.events.find(
                                (e) => e.id === detailItem.seriesId
                              )
                              if (event?.recurrence) {
                                editItem(detailItem)
                                return
                              }
                              if (event)
                                void returnToTasks(event).catch((e) =>
                                  setError(formatLocalError(e))
                                )
                            }}
                          >
                            {returnLabel(detailItem.event)}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              otherPlannedBlocks(detailItem.event)
                                ? "У задачи есть другие запланированные блоки. Будет снят только выбранный блок."
                                : detailItem.event.recurrence
                                  ? "Выберите экземпляр или всю серию в редакторе."
                                  : "Рабочий блок снимается с плана. Задача и её срок сохраняются."
                            )}
                          </p>
                        </div>
                      )}
                    {detailItem.event.links[0] && (
                      <Button
                        variant="secondary"
                        onClick={() => openSource(detailItem.event.links[0])}
                      >
                        <ExternalLink />
                        {t("Открыть источник")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("Выберите событие в календаре, чтобы увидеть детали.")}
                  </p>
                ))}
            </aside>
          )}
        </div>
      )}
      <Modal open={advanced && !calendarEdit} onOpenChange={setAdvanced}>
        <ModalContent className="max-h-[85vh] overflow-auto md:max-w-xl">
          <ModalTitle>{t("Параметры календаря")}</ModalTitle>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setFocus(!focus)
                setAdvanced(false)
              }}
            >
              {t(focus ? "Выйти из фокуса" : "Фокусный режим")}
            </Button>{" "}
            <div className="space-y-4 text-sm">
              <label className="block">
                {t("Начало недели")}
                <select
                  value={settings.weekStart}
                  aria-label={t("Начало недели")}
                  onChange={(e) => patch({ weekStart: Number(e.target.value) })}
                  className="ml-2 rounded border bg-background"
                >
                  <option value={1}>{t("Понедельник")}</option>
                  <option value={0}>{t("Воскресенье")}</option>
                </select>
              </label>
              {(settings.view === "day" || settings.view === "week") && (
                <label className="block">
                  {t("Шаг времени")}
                  <select
                    className="ml-2 rounded border bg-background"
                    value={settings.snap}
                    aria-label={t("Шаг времени")}
                    onChange={(e) => patch({ snap: Number(e.target.value) })}
                  >
                    {[5, 15, 30, 60].map((n) => (
                      <option value={n} key={n}>
                        {n} {t("мин")}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(settings.view === "day" || settings.view === "week") && (
                <label className="block">
                  {t("Масштаб")}
                  <input
                    type="range"
                    aria-label={t("Масштаб")}
                    min={40}
                    max={140}
                    value={settings.zoom}
                    onChange={(e) => patch({ zoom: Number(e.target.value) })}
                  />
                </label>
              )}
              {settings.view === "agenda" && (
                <label className="block">
                  {t("Сортировка событий")}
                  <select
                    className="ml-2 rounded border bg-background"
                    value={settings.sort}
                    aria-label={t("Сортировка событий")}
                    onChange={(e) => patch({ sort: e.target.value })}
                  >
                    <option value="time">{t("По времени")}</option>
                    <option value="title">{t("По названию")}</option>
                  </select>
                </label>
              )}
            </div>
          </div>
        </ModalContent>
      </Modal>
      {context && (
        <Menu open onOpenChange={(open) => !open && setContext(null)}>
          <MenuTrigger
            render={
              <button
                aria-label={t("Действия с событием")}
                className="pointer-events-none fixed size-px opacity-0"
                style={{ left: context.x, top: context.y }}
              />
            }
          />
          <MenuContent align="start">
            <MenuItem onClick={() => openItem(context.item)}>
              {t("Детали")}
            </MenuItem>
            <MenuItem onClick={() => editItem(context.item)}>
              {context.item.deadline
                ? t("Открыть источник")
                : t("Редактировать событие")}
            </MenuItem>
            {context.item.event.links[0] && (
              <MenuItem onClick={() => openSource(context.item.event.links[0])}>
                {t("Перейти к карточке")}
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      )}
      {calendarEdit && sources && (
        <CalendarEditor
          value={calendarEdit}
          state={state}
          sources={sources}
          onSaved={(calendar) => {
            if (!calendarEdit.updatedAt && settings.visibleCalendarIds)
              patch({
                visibleCalendarIds: [
                  ...new Set([...settings.visibleCalendarIds, calendar.id]),
                ],
              })
          }}
          onClose={() => {
            setCalendarEdit(null)
            if (location.search) history.replaceState(null, "", "/calendar")
          }}
        />
      )}
      {eventEdit && sources && (
        <EventEditor
          key={eventEdit.event.id + (eventEdit.instance ?? "")}
          value={eventEdit.event}
          instance={eventEdit.instance}
          intent={eventEdit.intent}
          state={state}
          sources={sources}
          onOpenSource={openSource}
          returnLabel={returnLabel(eventEdit.event)}
          onReturnToTasks={
            canReturnToTasks(eventEdit.event)
              ? () => {
                  setSelectedItem(null)
                  setReleasedCard(
                    eventEdit.event.links.find((l) => l.type === "card")?.id ??
                      null
                  )
                }
              : undefined
          }
          onClose={() => {
            setEventEdit(null)
            if (location.search) history.replaceState(null, "", "/calendar")
          }}
        />
      )}
      {moreDay && (
        <Modal open onOpenChange={(open) => !open && setMoreDay(null)}>
          <ModalContent className="max-h-[85vh] overflow-auto md:max-w-xl">
            <ModalTitle>{t("События дня")}</ModalTitle>
            <div className="flex items-center">
              <h2 className="mr-auto text-base">{moreDay}</h2>
            </div>
            {dayItems(moreDay).map((i) => (
              <button
                key={i.key}
                className="my-2 block w-full rounded border p-2 text-left text-sm"
                onClick={() => {
                  openItem(i)
                  setMoreDay(null)
                }}
              >
                {itemLabel(i)}
              </button>
            ))}
            <Button
              onClick={() => {
                create(zonedInstant(moreDay + "T10:00", zone) ?? undefined)
                setMoreDay(null)
              }}
            >
              {t("Создать событие")}
            </Button>
          </ModalContent>
        </Modal>
      )}
    </div>
  )
}
