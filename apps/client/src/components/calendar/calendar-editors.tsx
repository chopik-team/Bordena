import { useEffect, useRef, useState } from "react"
import { t, useT } from "@bordena/i18n"
import {
  Button,
  DateInput,
  Modal,
  ModalContent,
  ModalTitle,
} from "@bordena/ui-kit"
import {
  wallTime,
  zonedInstant,
  calendarSource,
  calendarDayShift,
  hasPlannedWork,
  type CalendarSources,
} from "@bordena/core"
import type {
  BordenaCalendar,
  CalendarEvent,
  CalendarState,
  ScheduleLink,
} from "@bordena/contract"
import { GENERAL_CALENDAR_ID } from "@bordena/contract"
import {
  saveCalendar,
  saveCalendarEvent,
  cancelCalendarPlan,
} from "@/lib/calendar-data"
import { applyOperations } from "@/lib/exchange/changeset"
import { deadlineInstant } from "@bordena/core"
import { formatLocalError } from "@/lib/local-error"
import { HistoryModal } from "../history/history-modal"
import { calendarEventOnDate } from "@/lib/calendar-event-date"
const input = "mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
function calendarError(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Stale revision:"))
    return t("Запись изменена в другом окне. Откройте её заново.")
  return formatLocalError(error)
}
function Failure({ value }: { value: string }) {
  return value ? (
    <p role="alert" className="text-sm text-destructive">
      {value}
    </p>
  ) : null
}
/** Reuse the existing modal/button system for both calendar forms. */
function CalendarClosePrompt({
  open,
  onContinue,
  onDiscard,
  onSave,
}: {
  open: boolean
  onContinue: () => void
  onDiscard: () => void
  onSave: () => void
}) {
  const t = useT()
  return (
    <Modal open={open} onOpenChange={(next) => !next && onContinue()}>
      <ModalContent className="md:max-w-md">
        <ModalTitle>{t("Есть несохранённые изменения")}</ModalTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("Сохраните изменения или отмените их перед закрытием.")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onSave}>{t("Сохранить")}</Button>
          <Button variant="secondary" onClick={onDiscard}>
            {t("Не сохранять")}
          </Button>
          <Button variant="ghost" onClick={onContinue}>
            {t("Вернуться к редактированию")}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  )
}
function useCalendarWindowClose(
  dirty: boolean,
  busy: boolean,
  requestClose: (resume: () => void) => void
) {
  useEffect(() => {
    const listener = (event: Event) => {
      if (!dirty && !busy) return
      event.preventDefault()
      if (!busy)
        requestClose(
          (event as CustomEvent<{ resume: () => void }>).detail.resume
        )
    }
    window.addEventListener("bordena:before-close", listener)
    return () => window.removeEventListener("bordena:before-close", listener)
  }, [dirty, busy, requestClose])
}
export function CalendarEditor({
  value,
  sources,
  onClose,
  onSaved,
}: {
  value: BordenaCalendar
  state: CalendarState
  sources: CalendarSources
  onClose: () => void
  onSaved?: (calendar: BordenaCalendar) => void
}) {
  const t = useT(),
    [calendar, set] = useState(value),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmClose, setConfirmClose] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const afterSave = useRef(onClose)
  const dirty = JSON.stringify(calendar) !== JSON.stringify(value)
  const requestClose = (action = onClose) => {
    if (busy) return
    afterSave.current = action
    if (dirty) setConfirmClose(true)
    else action()
  }
  useCalendarWindowClose(dirty, busy, (resume) =>
    requestClose(() => {
      onClose()
      resume()
    })
  )
  const patch = (v: Partial<BordenaCalendar>) => set((c) => ({ ...c, ...v }))
  return (
    <Modal open onOpenChange={(open) => !open && requestClose()}>
      <ModalContent className="max-h-[90vh] min-w-0 overflow-auto p-5 md:max-w-xl [&_select]:max-w-full [&_select]:min-w-0">
        <ModalTitle>{t("Настройки календаря")}</ModalTitle>
        <form
          ref={form}
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (busy) return
            setBusy(true)
            void saveCalendar(calendar)
              .then(() => {
                onSaved?.(calendar)
                afterSave.current()
              })
              .catch((e) => setError(calendarError(e)))
              .finally(() => setBusy(false))
          }}
        >
          <label className="block text-sm">
            {t("Название")}
            <input
              required
              disabled={calendar.id === GENERAL_CALENDAR_ID}
              maxLength={4096}
              autoFocus
              value={calendar.title}
              onChange={(e) => patch({ title: e.target.value })}
              className={input}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm">{t("Цвет")}</legend>
            <div className="flex flex-wrap items-center gap-2">
              {[
                "#7866d5",
                "#d94c4c",
                "#df852b",
                "#c39c25",
                "#32996b",
                "#2a98b9",
                "#4c7cdb",
                "#b354b9",
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={t("Цвет {color}", { color })}
                  aria-pressed={calendar.color.toLowerCase() === color}
                  className="size-8 rounded-full border-2 focus-visible:outline-2 aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2"
                  style={{ backgroundColor: color }}
                  onClick={() => patch({ color })}
                />
              ))}
              <input
                aria-label={t("Свой цвет")}
                type="color"
                value={calendar.color}
                onChange={(e) => patch({ color: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patch({ color: "#7866d5" })}
              >
                {t("По умолчанию")}
              </Button>
            </div>
            <div
              className="rounded border-l-4 p-2 text-sm"
              style={{
                borderColor: calendar.color,
                backgroundColor: `color-mix(in srgb,${calendar.color} 16%,transparent)`,
              }}
            >
              {calendar.title || t("Новый календарь")}
            </div>
          </fieldset>
          <label className="block text-sm">
            {t("Описание")}
            <textarea
              value={calendar.description}
              onChange={(e) => patch({ description: e.target.value })}
              className={input}
            />
          </label>
          <label className="block text-sm">
            {t("Рабочее пространство")}
            <select
              className={input}
              value={calendar.workspaceId ?? ""}
              disabled={calendar.id === GENERAL_CALENDAR_ID}
              onChange={(e) =>
                patch({ workspaceId: e.target.value || undefined })
              }
            >
              <option value="">{t("Все пространства")}</option>
              {sources.sidebar?.workspaces?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t("Источники дедлайнов")}
            <select
              multiple
              disabled={calendar.id === GENERAL_CALENDAR_ID}
              className={input}
              value={calendar.sourceBoardIds}
              onChange={(e) =>
                patch({
                  sourceBoardIds: [...e.target.selectedOptions].map(
                    (o) => o.value
                  ),
                })
              }
            >
              {sources.dashboards
                .filter((b) => !b.deletedAt)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {t("Без выбора — все доски. Создаются только отметки сроков.")}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={calendar.showDeadlines}
              disabled={calendar.id === GENERAL_CALENDAR_ID}
              onChange={(e) => patch({ showDeadlines: e.target.checked })}
            />
            {t("Показывать дедлайны")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={calendar.favorite}
              onChange={(e) => patch({ favorite: e.target.checked })}
            />
            {t("Избранное")}
          </label>
          <label className="block text-sm">
            {t("Автоперенос")}
            <select
              className={input}
              value={calendar.reschedule}
              onChange={(e) =>
                patch({
                  reschedule: e.target.value as BordenaCalendar["reschedule"],
                })
              }
            >
              <option value="manual">{t("Вручную")}</option>
              <option value="next-day">{t("Следующий день")}</option>
              <option value="smart">{t("Ближайшее свободное окно")}</option>
            </select>
          </label>
          {calendar.reschedule !== "manual" && (
            <label className="block text-sm">
              {t("Горизонт поиска, дней")}
              <input
                type="number"
                min={1}
                max={90}
                value={calendar.horizon}
                onChange={(e) => patch({ horizon: Number(e.target.value) })}
                className={input}
              />
            </label>
          )}
          <Failure value={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {t("Сохранить")}
            </Button>
            {value.updatedAt > 0 && value.id !== GENERAL_CALENDAR_ID && (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setConfirmDelete(true)
                }}
              >
                {t("Удалить календарь")}
              </Button>
            )}
          </div>
          {confirmDelete && (
            <div role="alert" className="space-y-2 rounded border p-3">
              <p>
                {t(
                  "Удалить календарь? Его записи скроются, исходные карточки останутся. Действие можно отменить."
                )}
              </p>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void saveCalendar({ ...calendar, deletedAt: Date.now() })
                    .then(onClose)
                    .catch((e) => setError(calendarError(e)))
                    .finally(() => setBusy(false))
                }}
              >
                {t("Подтвердить удаление")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t("Отмена")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t(
              "Удалённый календарь можно вернуть через отмену или резервную копию. Связанные карточки сохраняются."
            )}
          </p>
        </form>
        <CalendarClosePrompt
          open={confirmClose}
          onContinue={() => {
            setConfirmClose(false)
            afterSave.current = onClose
          }}
          onDiscard={() => afterSave.current()}
          onSave={() => {
            setConfirmClose(false)
            form.current?.requestSubmit()
          }}
        />
      </ModalContent>
    </Modal>
  )
}
function WallInput({
  label,
  value,
  zone,
  onChange,
  onValidityChange,
}: {
  label: string
  value: string
  zone: string
  onChange: (value: string) => void
  onValidityChange: (invalid: boolean) => void
}) {
  const t = useT(),
    wall = wallTime(value, zone),
    [draft, setDraft] = useState(wall),
    [sourceWall, setSourceWall] = useState(wall)
  if (sourceWall !== wall) {
    setSourceWall(wall)
    setDraft(wall)
  }
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    field.current?.setCustomValidity("")
  }, [wall])
  const accept = (v: string) => {
    const instant = zonedInstant(v, zone)
    field.current?.setCustomValidity(
      v && instant === null
        ? t("Выбранное местное время недоступно в эту дату.")
        : ""
    )
    onValidityChange(instant === null)
    if (instant !== null) onChange(new Date(instant).toISOString())
  }
  return (
    <label className="block min-w-0 text-sm">
      {label}
      <div className="flex items-center gap-1">
        <input
          ref={field}
          type="datetime-local"
          required
          className={input}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            accept(e.target.value)
          }}
        />
        <DateInput
          withTime
          value={wall}
          onChange={(v) => {
            if (v) {
              const d = new Date(v),
                pad = (n: number) => String(n).padStart(2, "0")
              accept(
                `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
              )
            }
          }}
          inputProps={{ "aria-label": t("Календарь: {label}", { label }) }}
        >
          <span className="rounded border p-2 text-xs">▦</span>
        </DateInput>
      </div>
    </label>
  )
}
export function EventEditor({
  intent,
  value,
  state,
  sources,
  instance,
  onClose,
  onOpenSource,
  onReturnToTasks,
}: {
  intent?: "unschedule"
  value: CalendarEvent
  state: CalendarState
  sources: CalendarSources
  instance?: string
  onClose: () => void
  onOpenSource: (link: ScheduleLink) => void
  onReturnToTasks?: () => void
  returnLabel?: string
}) {
  // Keep the opening revision: another window must cause a conflict, never a stale overwrite.
  const [series] = useState(
    () => state.events.find((e) => e.id === value.id) ?? value
  )
  instance ??= value.recurrence
    ? wallTime(value.start, value.timeZone).slice(0, 10)
    : undefined
  const t = useT(),
    [event, set] = useState(value),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [invalidTime, setInvalidTime] = useState({ start: false, end: false }),
    [scope, setScope] = useState(instance ? "instance" : "series"),
    [linkType, setLinkType] = useState<ScheduleLink["type"]>("card"),
    [target, setTarget] = useState(""),
    [newCardSection, setNewCardSection] = useState(
      sources.columns.find((c) => !c.deletedAt)?.id ?? ""
    ),
    [historyOpen, setHistoryOpen] = useState(false),
    [confirmClose, setConfirmClose] = useState(false),
    [confirmRelease, setConfirmRelease] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const afterSave = useRef(onClose)
  const displayZone = event.allDay
    ? event.timeZone
    : Intl.DateTimeFormat().resolvedOptions().timeZone
  const dirty =
    invalidTime.start ||
    invalidTime.end ||
    JSON.stringify(event) !==
      JSON.stringify(scope === "series" ? series : value)
  const requestClose = (action = onClose) => {
    if (busy) return
    afterSave.current = action
    if (dirty) setConfirmClose(true)
    else action()
  }
  useCalendarWindowClose(dirty, busy, (resume) =>
    requestClose(() => {
      onClose()
      resume()
    })
  )
  const release = async (saveDraft: boolean) => {
    setBusy(true)
    setError("")
    try {
      await cancelCalendarPlan(
        series,
        scope === "instance" ? instance : undefined,
        saveDraft ? event : undefined
      )
      onReturnToTasks?.()
      onClose()
    } catch (e) {
      setError(calendarError(e))
    } finally {
      setBusy(false)
    }
  }
  const requestRelease = () =>
    dirty ? setConfirmRelease(true) : void release(false)
  const patch = (v: Partial<CalendarEvent>) => set((e) => ({ ...e, ...v }))
  const statusField = (
    <label className="block text-sm">
      {t("Состояние")}
      <select
        className={input}
        value={event.status}
        onChange={(e) =>
          patch({ status: e.target.value as CalendarEvent["status"] })
        }
      >
        <option value="planned">{t("Запланировано")}</option>
        <option value="completed">{t("Выполнено")}</option>
        <option value="cancelled">{t("Отменено")}</option>
      </select>
    </label>
  )
  const options: { value: string; title: string; link: ScheduleLink }[] = []
  for (const b of sources.dashboards.filter((b) => !b.deletedAt)) {
    if (linkType === "board" || (linkType === "goal" && b.goalPath))
      options.push({
        value: b.id,
        title: b.title,
        link: { type: linkType, id: b.id },
      })
    if (linkType === "stage" || linkType === "goal-step")
      for (const s of b.layout?.stages ?? [])
        options.push({
          value: b.id + ":" + s.id,
          title: b.title + " / " + s.title,
          link: { type: linkType, id: s.id, boardId: b.id },
        })
  }
  if (linkType === "card")
    for (const c of sources.cards.filter((c) => !c.deletedAt))
      options.push({
        value: c.id,
        title: c.title || t("Без названия"),
        link: { type: "card", id: c.id },
      })
  if (linkType === "section")
    for (const c of sources.columns.filter((c) => !c.deletedAt))
      options.push({
        value: c.id,
        title: c.title,
        link: { type: "section", id: c.id },
      })
  if (linkType === "project")
    for (const p of sources.sidebar?.items ?? [])
      if (p.type === "folder")
        options.push({
          value: p.id,
          title: p.title,
          link: { type: "project", id: p.id },
        })
  if (linkType === "workspace")
    for (const w of sources.sidebar?.workspaces ?? [])
      options.push({
        value: w.id,
        title: w.title,
        link: { type: "workspace", id: w.id },
      })
  return (
    <Modal open onOpenChange={(open) => !open && requestClose()}>
      <ModalContent className="max-h-[90vh] min-w-0 overflow-auto p-5 md:max-w-2xl [&_select]:max-w-full [&_select]:min-w-0">
        <ModalTitle>
          {t(value.updatedAt ? "Изменить событие" : "Новое событие")}
        </ModalTitle>
        {intent === "unschedule" && (
          <p className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
            {t(
              "Выберите экземпляр или всю серию, затем нажмите «Снять планирование»."
            )}
          </p>
        )}
        <form
          ref={form}
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (busy) return
            setError("")
            setBusy(true)
            const save =
              instance && scope === "instance"
                ? applyOperations([
                    {
                      op: "update-calendar-instance",
                      id: event.id,
                      expectedUpdatedAt: value.updatedAt,
                      day: instance,
                      patch: {
                        title: event.title,
                        start: event.start,
                        end: event.end,
                        status: event.status,
                      },
                    },
                  ])
                : saveCalendarEvent(event)
            void save
              .then(() => afterSave.current())
              .catch((e) => setError(calendarError(e)))
              .finally(() => setBusy(false))
          }}
        >
          <label className="block text-sm">
            {t("Название")}
            <input
              autoFocus
              required
              maxLength={4096}
              value={event.title}
              onChange={(e) => patch({ title: e.target.value })}
              className={input}
            />
          </label>
          <label className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
            <span className="font-semibold">{t("Перенести на дату")}</span>
            <DateInput
              value={wallTime(event.start, displayZone).slice(0, 10)}
              inputProps={{ "aria-label": t("Перенести на дату") }}
              onChange={(day) => {
                if (!day) return
                try {
                  set(calendarEventOnDate(event, day, displayZone))
                  setInvalidTime({ start: false, end: false })
                  setError("")
                } catch {
                  setError(t("Выбранное местное время недоступно в эту дату."))
                }
              }}
            >
              <Button type="button" variant="secondary" size="sm">
                {wallTime(event.start, displayZone).slice(0, 10)}
              </Button>
            </DateInput>
            <span className="text-xs text-muted-foreground">
              {t("Время начала и длительность сохраняются.")}
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <WallInput
              label={t("Начало")}
              value={event.start}
              zone={displayZone}
              onValidityChange={(start) =>
                setInvalidTime((v) => ({ ...v, start }))
              }
              onChange={(start) => patch({ start })}
            />
            <WallInput
              label={t("Окончание")}
              value={event.end}
              zone={displayZone}
              onValidityChange={(end) => setInvalidTime((v) => ({ ...v, end }))}
              onChange={(end) => patch({ end })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              {t("Календарь")}
              <select
                className={input}
                disabled={!!instance && scope === "instance"}
                value={event.calendarId}
                aria-label={t("Календарь")}
                onChange={(e) => patch({ calendarId: e.target.value })}
              >
                {state.calendars
                  .filter((c) => !c.deletedAt)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.id === GENERAL_CALENDAR_ID
                        ? t("Общий календарь")
                        : c.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              {t("Тип записи")}
              <select
                className={input}
                disabled={!!instance && scope === "instance"}
                value={event.kind}
                onChange={(e) =>
                  patch({ kind: e.target.value as CalendarEvent["kind"] })
                }
              >
                <option value="event">{t("Событие")}</option>
                <option value="block">{t("Рабочий блок")}</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!!instance && scope === "instance"}
              checked={event.allDay}
              onChange={(e) => {
                const day = wallTime(event.start, displayZone).slice(0, 10)
                patch(
                  e.target.checked
                    ? {
                        allDay: true,
                        start: new Date(
                          zonedInstant(day + "T00:00", event.timeZone)!
                        ).toISOString(),
                        end: new Date(
                          zonedInstant(
                            calendarDayShift(day, 1) + "T00:00",
                            event.timeZone
                          )!
                        ).toISOString(),
                      }
                    : { allDay: false }
                )
              }}
            />
            {t("Весь день")}
          </label>
          {instance && (
            <label className="block text-sm">
              {t("Изменить")}
              <select
                className={input}
                value={scope}
                aria-label={t("Изменить")}
                onChange={(e) => {
                  setScope(e.target.value)
                  if (!dirty) set(e.target.value === "series" ? series : value)
                }}
              >
                <option value="instance">{t("Только этот экземпляр")}</option>
                <option value="series">{t("Всю серию")}</option>
              </select>
            </label>
          )}
          {instance && scope === "instance" && statusField}
          <details>
            <summary className="cursor-pointer text-sm">
              {t("Дополнительно")}
            </summary>
            <fieldset
              disabled={!!instance && scope === "instance"}
              className="mt-3 space-y-3 disabled:opacity-60"
            >
              {instance && scope === "instance" && (
                <p>{t("Свойства серии доступны при выборе всей серии.")}</p>
              )}
              <label className="block text-sm">
                {t("Описание")}
                <textarea
                  maxLength={4096}
                  className={input}
                  value={event.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </label>
              {!(instance && scope === "instance") && statusField}
              <label className="block text-sm">
                {t("Повторение")}
                <select
                  className={input}
                  value={event.recurrence?.frequency ?? ""}
                  onChange={(e) =>
                    patch({
                      recurrence: e.target.value
                        ? {
                            frequency: e.target.value as NonNullable<
                              CalendarEvent["recurrence"]
                            >["frequency"],
                            interval: 1,
                          }
                        : undefined,
                    })
                  }
                >
                  <option value="">{t("Не повторять")}</option>
                  <option value="daily">{t("Каждый день")}</option>
                  <option value="weekly">{t("Каждую неделю")}</option>
                  <option value="monthly">{t("Каждый месяц")}</option>
                  <option value="yearly">{t("Каждый год")}</option>
                </select>
              </label>
              {event.recurrence && (
                <div className="space-y-2">
                  <label className="block text-sm">
                    {t("Интервал повторения")}
                    <input
                      className={input}
                      type="number"
                      min={1}
                      max={365}
                      value={event.recurrence.interval}
                      onChange={(e) =>
                        patch({
                          recurrence: {
                            ...event.recurrence!,
                            interval: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  {event.recurrence.frequency === "weekly" && (
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                        <label key={day} className="text-xs">
                          <input
                            type="checkbox"
                            checked={
                              event.recurrence?.weekdays?.includes(day) ?? false
                            }
                            onChange={(e) =>
                              patch({
                                recurrence: {
                                  ...event.recurrence!,
                                  weekdays: e.target.checked
                                    ? [
                                        ...(event.recurrence!.weekdays ?? []),
                                        day,
                                      ]
                                    : (event.recurrence!.weekdays ?? []).filter(
                                        (d) => d !== day
                                      ),
                                },
                              })
                            }
                          />
                          {new Intl.DateTimeFormat(undefined, {
                            weekday: "short",
                            timeZone: "UTC",
                          }).format(new Date(Date.UTC(2026, 9, 18 + day)))}
                        </label>
                      ))}
                    </div>
                  )}
                  <label className="block text-sm">
                    {t("Повторять до")}
                    <input
                      type="date"
                      className={input}
                      value={event.recurrence.until ?? ""}
                      onChange={(e) =>
                        patch({
                          recurrence: {
                            ...event.recurrence!,
                            until: e.target.value || undefined,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    {t("Количество повторений")}
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      className={input}
                      value={event.recurrence.count ?? ""}
                      onChange={(e) =>
                        patch({
                          recurrence: {
                            ...event.recurrence!,
                            count: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              )}
              {event.kind === "block" && !event.recurrence && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={event.flexible}
                      onChange={(e) => patch({ flexible: e.target.checked })}
                    />
                    {t("Гибкое время")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={event.pinned}
                      onChange={(e) => patch({ pinned: e.target.checked })}
                    />
                    {t("Закрепить время")}
                  </label>
                  <label className="block text-sm">
                    {t("Автоперенос")}
                    <select
                      className={input}
                      value={event.reschedule ?? ""}
                      onChange={(e) =>
                        patch({
                          reschedule:
                            (e.target.value as CalendarEvent["reschedule"]) ||
                            undefined,
                        })
                      }
                    >
                      <option value="">{t("Как в календаре")}</option>
                      <option value="manual">{t("Вручную")}</option>
                      <option value="next-day">{t("Следующий день")}</option>
                      <option value="smart">
                        {t("Ближайшее свободное окно")}
                      </option>
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Автоперенос доступен гибким разовым блокам со связью. Поиск: ежедневно 09:00–20:00 по местному времени, с учётом занятых интервалов и срока."
                    )}
                  </p>
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={event.syncCompletion}
                  onChange={(e) => patch({ syncCompletion: e.target.checked })}
                />
                {t("Завершать блок при выполнении источника")}
              </label>
              <label className="block text-sm">
                {t("Напоминание, минут до начала")}
                <input
                  className={input}
                  type="number"
                  min={0}
                  max={525600}
                  placeholder={t("Без уведомления")}
                  value={event.reminderMinutes ?? ""}
                  onChange={(e) =>
                    patch({
                      reminderMinutes: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Уведомления доступны только при включённой настройке Windows и работающей Bordena."
                )}
              </p>
              <fieldset className="space-y-2">
                <legend className="text-sm">{t("Связи")}</legend>
                {event.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => requestClose(() => onOpenSource(link))}
                    >
                      {t(link.type)}:{" "}
                      {calendarSource(link, sources, state).title ||
                        t("Источник недоступен")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("Удалить связь")}
                      onClick={() =>
                        patch({
                          links: event.links.filter((_, at) => at !== i),
                        })
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <select
                  aria-label={t("Тип источника")}
                  className={input}
                  value={linkType}
                  onChange={(e) => {
                    setLinkType(e.target.value as ScheduleLink["type"])
                    setTarget("")
                  }}
                >
                  {(
                    [
                      "card",
                      "board",
                      "section",
                      "stage",
                      "goal",
                      "goal-step",
                      "project",
                      "workspace",
                    ] as const
                  ).map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
                <select
                  className={input}
                  aria-label={t("Источник")}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">{t("Выберите объект")}</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!target}
                  onClick={() => {
                    const link = options.find((o) => o.value === target)?.link
                    if (link) patch({ links: [...event.links, link] })
                  }}
                >
                  {t("Добавить связь")}
                </Button>
              </fieldset>
              {event.links.some((l) => {
                const source = calendarSource(l, sources, state)
                return (
                  source.deadline &&
                  Date.parse(event.end) > deadlineInstant(source.deadline)
                )
              }) && (
                <p className="text-xs text-destructive">
                  {t("После исходного дедлайна")}
                </p>
              )}
              {value.updatedAt > 0 &&
                !event.links.some((l) => l.type === "card") && (
                  <div className="space-y-2">
                    <label className="block text-sm">
                      {t("Секция новой карточки")}
                      <select
                        className={input}
                        value={newCardSection}
                        onChange={(e) => setNewCardSection(e.target.value)}
                      >
                        {sources.columns
                          .filter((c) => !c.deletedAt)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {
                                sources.dashboards.find(
                                  (b) => b.id === c.dashboardId
                                )?.title
                              }{" "}
                              / {c.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy || !newCardSection}
                      onClick={() => {
                        setBusy(true)
                        const id = crypto.randomUUID()
                        void applyOperations([
                          {
                            op: "create-card",
                            id,
                            columnId: newCardSection,
                            title: event.title,
                            body: event.description,
                          },
                          {
                            op: "update-calendar-event",
                            id: event.id,
                            expectedUpdatedAt: value.updatedAt,
                            event: {
                              ...event,
                              links: [...event.links, { type: "card", id }],
                            },
                          },
                        ])
                          .then(onClose)
                          .catch((e) => setError(calendarError(e)))
                          .finally(() => setBusy(false))
                      }}
                    >
                      {t("Создать карточку из события")}
                    </Button>
                  </div>
                )}
            </fieldset>
          </details>
          <Failure value={error} />
          {confirmRelease && (
            <div role="alert" className="space-y-2 rounded-lg border p-3">
              <p>{t("Есть несохранённые изменения")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void release(true)}
                >
                  {t("Сохранить и снять блок")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void release(false)}
                >
                  {t("Отменить правки и снять блок")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmRelease(false)}
                >
                  {t("Вернуться к редактированию")}
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {t("Сохранить")}
            </Button>
            {value.updatedAt > 0 &&
              hasPlannedWork(series) &&
              event.kind === "block" &&
              event.links.some((l) => l.type === "card") && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={requestRelease}
                >
                  {t(
                    instance
                      ? scope === "instance"
                        ? "Снять этот экземпляр с расписания"
                        : "Снять серию с расписания"
                      : state.events.some(
                            (other) =>
                              other.id !== event.id &&
                              hasPlannedWork(other) &&
                              other.links.some(
                                (l) =>
                                  l.type === "card" &&
                                  event.links.some(
                                    (a) => a.type === "card" && a.id === l.id
                                  )
                              )
                          )
                        ? "Снять этот блок с расписания"
                        : "Вернуть в незапланированные"
                  )}
                </Button>
              )}
            {value.updatedAt > 0 && (
              <Button variant="ghost" onClick={() => setHistoryOpen(true)}>
                {t("История события")}
              </Button>
            )}
            {value.updatedAt > 0 && event.kind !== "block" && (
              <Button
                variant="destructive"
                disabled={busy}
                type="button"
                onClick={requestRelease}
              >
                {t("Отменить событие")}
              </Button>
            )}
          </div>
        </form>
        <CalendarClosePrompt
          open={confirmClose}
          onContinue={() => {
            setConfirmClose(false)
            afterSave.current = onClose
          }}
          onDiscard={() => afterSave.current()}
          onSave={() => {
            setConfirmClose(false)
            form.current?.requestSubmit()
          }}
        />
        <HistoryModal
          entityType="card"
          entityId={event.id}
          title={t("История события")}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      </ModalContent>
    </Modal>
  )
}
