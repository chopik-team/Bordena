import { t } from "@bordena/i18n"
import {
  type Card,
  type Column,
  type Dashboard,
  type SidebarLayout,
} from "@bordena/core"
import { webDb } from "./adapters/web-db"
import { preferencesSnapshot } from "./preferences"
import { isCardOverdue } from "./deadlines"
import { isDesktop } from "./platform"
import { invoke } from "@tauri-apps/api/core"
import {CalendarStateSchema,emptyCalendarState} from '@bordena/contract'
import {calendarOccurrences} from '@bordena/core'

let checking = false
export async function checkDeadlineNotifications(
  now = Date.now()
): Promise<number> {
  if (!preferencesSnapshot().windowsNotifications || checking) return 0
  checking = true
  try {
    const [cards, columns, boards, sidebar] = await Promise.all([
      webDb.getAll<Card>("cards"),
      webDb.getAll<Column>("columns"),
      webDb.getAll<Dashboard>("dashboards"),
      webDb.get<SidebarLayout>("sidebar", "layout"),
    ])
    const archivedProjects = new Set(
      (sidebar?.items ?? []).flatMap((item) =>
        item.type === "folder" && item.archived ? item.boardIds : []
      )
    )
    const activeBoards = new Set(
      boards
        .filter(
          (board) =>
            !board.deletedAt &&
            !board.archived &&
            !archivedProjects.has(board.id)
        )
        .map((board) => board.id)
    )
    const cols = new Map(
      columns
        .filter((c) => !c.deletedAt && activeBoards.has(c.dashboardId))
        .map((c) => [c.id, c])
    )
    const boardById = new Map(boards.map((b) => [b.id, b]))
    const candidates: { key: string; title: string; deadline: string }[] = cards
      .filter(
        (card) =>
          cols.has(card.columnId) &&
          isCardOverdue(
            card,
            cols.get(card.columnId),
            now,
            boardById.get(cols.get(card.columnId)!.dashboardId)?.layout
          )
      )
      .map((card) => ({
        key: `card:${card.id}`,
        title: card.title,
        deadline: card.deadline!,
      }))
    for (const board of boards)
      if (
        activeBoards.has(board.id) &&
        isCardOverdue(
          { deadline: board.deadline ?? null, deletedAt: board.deletedAt },
          undefined,
          now
        )
      )
        candidates.push({
          key: `board:${board.id}`,
          title: board.title,
          deadline: board.deadline!,
        })
    for (const project of sidebar?.items ?? [])
      if (
        project.type === "folder" &&
        !project.archived &&
        isCardOverdue(
          { deadline: project.deadline ?? null, deletedAt: null },
          undefined,
          now
        )
      )
        candidates.push({
          key: `project:${project.id}`,
          title: project.title,
          deadline: project.deadline!,
        })
    const selected: typeof candidates = []
    const calendar=CalendarStateSchema.parse((await webDb.get('meta','bordena:calendar'))??emptyCalendarState())
    for(const event of calendar.events)if(event.reminderMinutes!==undefined&&calendar.calendars.some(c=>c.id===event.calendarId&&!c.deletedAt)) {
      for(const occurrence of calendarOccurrences(event,now-86400000,now+event.reminderMinutes*60000+60000)) {
        const due=occurrence.start-event.reminderMinutes*60000
        if(due<=now&&occurrence.end>now&&occurrence.event.status==='planned')candidates.push({key:`calendar:${occurrence.key}`,title:occurrence.event.title,deadline:new Date(due).toISOString()})
      }
    }
    await webDb.update<Record<string, string>>(
      "meta",
      "bordena:deadline-notifications",
      (current) => {
        const next = { ...current }
        for (const candidate of candidates)
          if (next[candidate.key] !== candidate.deadline) {
            selected.push(candidate)
            next[candidate.key] = candidate.deadline
          }
        const liveIds = new Set([
          ...candidates.filter(c=>c.key.startsWith('calendar:')).map(c=>c.key),
          ...cards.filter((c) => !c.deletedAt).map((c) => `card:${c.id}`),
          ...boards.filter((b) => !b.deletedAt).map((b) => `board:${b.id}`),
          ...(sidebar?.items ?? [])
            .filter((i) => i.type === "folder")
            .map((i) => `project:${i.id}`),
        ])
        for (const id of Object.keys(next))
          if (!liveIds.has(id)) delete next[id]
        return next
      }
    )
    if (!selected.length) return 0
    await invoke("notify_deadline", {
      title: "Bordena",
      body: `${t("Просрочено объектов: {count}", { count: selected.length })}\n${selected
        .slice(0, 3)
        .map((card) => card.title)
        .join(" · ")}`.slice(0, 240),
    })
    return selected.length
  } finally {
    checking = false
  }
}
export async function installDeadlineNotifications(): Promise<void> {
  if (!isDesktop()) return
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  if (getCurrentWindow().label !== "main") return
  const check = () =>
    void checkDeadlineNotifications().catch((error) =>
      window.dispatchEvent(
        new CustomEvent("bordena:automation-error", { detail: String(error) })
      )
    )
  check()
  setInterval(check, 30000)
}
