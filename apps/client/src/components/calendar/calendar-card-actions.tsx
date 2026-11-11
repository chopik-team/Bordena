import { useState } from "react"
import { EventEditor } from "./calendar-editors"
import { calendarOccurrences, hasPlannedWork } from "@bordena/core"
import {
  useCalendarSources,
  eventDefaults,
  planningCalendarId,
} from "@/lib/calendar-data"
import type { CalendarEvent } from "@bordena/contract"
import { useLocale } from "@bordena/i18n"
import { useT } from "@bordena/i18n"
import { Button } from "@bordena/ui-kit"
import { CalendarClock } from "lucide-react"
import { useLocation } from "wouter"
import { useCalendarState } from "@/lib/calendar-data"
import { GENERAL_CALENDAR_ID } from "@bordena/contract"
import { useCard, useUpdateCard } from "@bordena/core"
export function CalendarCardActions({ cardId }: { cardId: string }) {
  const locale = useLocale()
  const [openedAt] = useState(() => Date.now())
  const { data: sources } = useCalendarSources()
  const [edit, setEdit] = useState<{
    event: CalendarEvent
    instance?: string
  } | null>(null)
  const [released, setReleased] = useState(false)
  const openPlan = (event: CalendarEvent) => {
    const occurrence = event.recurrence
      ? calendarOccurrences(event, openedAt, openedAt + 366 * 86400000).find(
          (o) => o.event.status === "planned"
        )
      : undefined
    setEdit({
      event: occurrence
        ? {
            ...event,
            ...occurrence.event,
            start: new Date(occurrence.start).toISOString(),
            end: new Date(occurrence.end).toISOString(),
          }
        : event,
      instance: occurrence?.day,
    })
  }
  const t = useT(),
    [, navigate] = useLocation(),
    { data: state } = useCalendarState(),
    { data: card } = useCard(cardId),
    { mutate: update, isPending } = useUpdateCard(cardId)
  const calendars =
    state?.calendars.filter(
      (c) => !c.deletedAt && c.id !== GENERAL_CALENDAR_ID
    ) ?? []
  const missing =
    card?.calendarId &&
    card.calendarId !== GENERAL_CALENDAR_ID &&
    !calendars.some((c) => c.id === card.calendarId)
  return (
    <div className="space-y-2 border-b px-4 py-3">
      <h3 className="text-sm font-semibold">{t("Планирование")}</h3>
      <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        {t("Календарь карточки")}
        <select
          className="max-w-full min-w-0 flex-1 truncate rounded border bg-background p-2"
          aria-label={t("Календарь карточки")}
          value={card?.calendarId ?? ""}
          disabled={!card || isPending}
          onChange={(e) => update({ calendarId: e.target.value || null })}
        >
          <option value="">{t("По умолчанию для доски")}</option>
          <option value={GENERAL_CALENDAR_ID}>{t("Общий календарь")}</option>
          {missing && (
            <option value={card!.calendarId!}>
              {t("Календарь недоступен")}
            </option>
          )}
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        {t(
          "Карточка всегда видна в общем календаре. Без срока она находится в незапланированных задачах."
        )}
      </p>
      {state?.events
        .filter(
          (e) =>
            hasPlannedWork(e) &&
            e.links.some((l) => l.type === "card" && l.id === cardId)
        )
        .map((event) => (
          <div key={event.id} className="rounded-lg border p-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => openPlan(event)}
            >
              <CalendarClock />
              {t("Изменить план")}
              {" · "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(event.start))}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate(`~/calendar?event=${encodeURIComponent(event.id)}`)
              }
            >
              {t("Открыть в календаре")}
            </Button>
          </div>
        ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => {
          if (!state || !card) return
          const at = new Date()
          at.setMinutes(0, 0, 0)
          const board = sources?.dashboards.find(
            (b) =>
              b.id ===
              sources.columns.find((c) => c.id === card.columnId)?.dashboardId
          )
          const calendar = state.calendars.find(
            (c) => c.id === planningCalendarId(state.calendars, card, board)
          )!
          setEdit({
            event: {
              ...eventDefaults(
                calendar.id,
                at,
                card.title.trim() || t("Без названия")
              ),
              kind: "block",
              links: [{ type: "card", id: card.id }],
            },
          })
        }}
      >
        <CalendarClock />
        {state?.events.some(
          (e) =>
            hasPlannedWork(e) &&
            e.links.some((l) => l.type === "card" && l.id === cardId)
        )
          ? t("Добавить ещё рабочий блок")
          : t("Запланировать рабочий блок")}
      </Button>
      {released && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("Планирование снято. Исходная карточка сохранена.")}
        </p>
      )}
      {edit && sources && state && (
        <EventEditor
          key={edit.event.id}
          value={edit.event}
          instance={edit.instance}
          state={state}
          sources={sources}
          onClose={() => setEdit(null)}
          onReturnToTasks={() => setReleased(true)}
          onOpenSource={() => setEdit(null)}
        />
      )}
    </div>
  )
}
