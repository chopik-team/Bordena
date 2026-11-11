import { useT } from "@bordena/i18n"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { format, isValid, parse } from "date-fns"
import { X } from "lucide-react"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { cn } from "./lib/cn"
import { focusTriggerOnKeyboardClose } from "./lib/final-focus"
import { useState } from "react"
import {
  addDays,
  todayIso,
  deadlineLocalParts,
  localDeadline,
  deadlineCalendarDate,
} from "@bordena/utils"
const ISO = "yyyy-MM-dd"
function isoToDate(value: string | null | undefined) {
  if (!value) return undefined
  const date = parse(value, ISO, new Date())
  return isValid(date) ? date : undefined
}
function dateToIso(date: Date | undefined) {
  return date ? format(date, ISO) : null
}
export interface DateInputCalendarProps {
  value: string | null
  onSelect: (value: string | null) => void
  withTime?: boolean
  calendarProps?: Omit<
    React.ComponentProps<typeof Calendar>,
    "mode" | "selected" | "onSelect"
  >
}
/**
 * The desktop calendar popover content. Lives in its own module so the calendar
 * (and `react-day-picker`/`date-fns`) is only fetched when first opened, never
 * on mobile where the native date input is used instead.
 */
export default function DateInputCalendar({
  value,
  onSelect,
  calendarProps,
  withTime,
}: DateInputCalendarProps) {
  const t = useT()
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        sideOffset={4}
        align="start"
        className="z-60"
      >
        <PopoverPrimitive.Popup
          data-slot="date-input-popup"
          finalFocus={focusTriggerOnKeyboardClose}
          className={cn(
            "overflow-hidden rounded-lg border bg-popover",
            "text-popover-foreground shadow-e3 outline-none",
            "transition-[opacity,transform] duration-50",
            "data-ending-style:opacity-0 data-starting-style:opacity-0",
            "data-starting-style:scale-95"
          )}
        >
          {withTime ? (
            <DateTimeCalendar value={value} onSelect={onSelect} />
          ) : (
            <>
              <Calendar
                mode="single"
                selected={isoToDate(value)}
                onSelect={(date) => onSelect(dateToIso(date))}
                autoFocus
                {...calendarProps}
              />
              <div className="grid grid-cols-2 gap-1 border-t p-1 bg-background">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelect(null)}
                  className="text-muted-foreground"
                >
                  <X className="size-3.5" />
                  {t("Очистить")}{" "}
                </Button>
                <PopoverPrimitive.Close
                  render={
                    <Button variant="ghost" size="sm">
                      {t("Сохранить")}{" "}
                    </Button>
                  }
                />
              </div>
            </>
          )}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

/** Shared staged calendar for deadlines and dates anchored in Markdown. No writes until Apply. */
export function DateTimeCalendar({
  value,
  onSelect,
  onCancel,
  allowClear = true,
}: {
  value: string | null
  onSelect: (value: string | null) => void
  onCancel?: () => void
  allowClear?: boolean
}) {
  const t = useT()
  const [draft, setDraft] = useState(() => deadlineLocalParts(value))
  const [timed, setTimed] = useState(() => !!deadlineLocalParts(value).time)
  const [month, setMonth] = useState(
    () => isoToDate(deadlineLocalParts(value).date) ?? new Date()
  )
  const [zone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const original = deadlineLocalParts(value)
  const unchanged =
    draft.date === original.date &&
    timed === !!original.time &&
    (!timed || draft.time === original.time)
  const result =
    unchanged && value
      ? value
      : timed && !draft.time
        ? null
        : localDeadline(draft.date, timed ? draft.time : "")
  const selectDate = (date: string) => {
    setDraft((current) => ({ ...current, date }))
    const next = isoToDate(date)
    if (next) setMonth(next)
  }
  return (
    <div className="w-full min-w-0 max-w-80 p-3" data-slot="date-time-calendar">
      <div className="mb-2 flex flex-wrap gap-1">
        {[0, 1, 7].map((days) => (
          <Button
            type="button"
            key={days}
            size="sm"
            variant="ghost"
            onClick={() => selectDate(addDays(todayIso(), days))}
          >
            {t(days === 0 ? "Today" : days === 1 ? "Tomorrow" : "In a week")}
          </Button>
        ))}
      </div>
      <Calendar
        mode="single"
        selected={isoToDate(draft.date)}
        month={month}
        onMonthChange={setMonth}
        onSelect={(date) => {
          if (date) selectDate(deadlineCalendarDate(format(date, ISO)))
        }}
        className="mx-auto w-full bg-transparent [--cell-size:--spacing(9)]"
      />
      <label className="mt-2 flex items-center justify-between gap-2 text-sm">
        {t("Дата")}
        <input
          aria-label={t("Дата календаря")}
          type="date"
          className="min-w-0 rounded border bg-background px-2 py-1.5"
          value={draft.date}
          onChange={(event) => selectDate(event.target.value)}
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={timed}
          onChange={(event) => {
            setTimed(event.target.checked)
            setDraft({
              ...draft,
              date: draft.date || todayIso(),
              time: draft.time || "09:00",
            })
          }}
        />
        {t("Указать время")}
      </label>
      {timed && (
        <label className="mt-2 flex items-center justify-between gap-2 text-sm">
          {t("Время")}
          <input
            type="time"
            aria-label={t("Время календаря")}
            step="60"
            className="rounded border bg-background px-2 py-1.5"
            value={draft.time}
            onChange={(event) =>
              setDraft({ ...draft, time: event.target.value })
            }
          />
        </label>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {timed
          ? t("Местное время: {zone}", { zone })
          : t("Без времени — до конца дня")}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        {allowClear && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onSelect(null)}
          >
            {t("Убрать дату")}
          </Button>
        )}
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t("Отмена")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={!result}
          onClick={() => {
            if (result) onSelect(result)
          }}
        >
          {t("Применить")}
        </Button>
      </div>
    </div>
  )
}
