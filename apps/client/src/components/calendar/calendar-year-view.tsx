import { useMemo, useState } from "react"
import { useLocale, useT } from "@bordena/i18n"
import {
  calendarDayShift,
  calendarWeekday,
  calendarYearStats,
  wallTime,
  type YearItem,
} from "@bordena/core"
import type { BordenaCalendar } from "@bordena/contract"

export function CalendarYearView({
  year,
  zone,
  weekStart,
  items,
  calendars,
  onMonth,
  onDay,
}: {
  year: number
  zone: string
  weekStart: number
  items: YearItem[]
  calendars: BordenaCalendar[]
  onMonth: (day: string) => void
  onDay: (day: string) => void
}) {
  const t = useT(),
    locale = useLocale()
  const [metric, setMetric] = useState<
    "busyHours" | "plannedHours" | "deadlineCount" | "eventCount"
  >("busyHours")
  const stats = useMemo(
    () => calendarYearStats(year, zone, items),
    [year, zone, items]
  )
  const current = wallTime(Date.now(), zone).slice(0, 10)
  const dateFormat = new Intl.DateTimeFormat(locale, { month: "long" })
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v)
  const effective = metric
  const maximum = Math.max(1, ...stats.map((m) => m[effective] ?? 0))
  const busyDays = useMemo(() => {
    const map = new Map<string, { count: number; colors: Set<string> }>()
    for (const item of items) {
      if (item.event.status === "cancelled") continue
      let day = wallTime(item.start, zone).slice(0, 10),
        last = wallTime(item.end - 1, zone).slice(0, 10)
      const first = `${year}-01-01`,
        end = `${year + 1}-01-01`
      if (day < first) day = first
      if (last >= end) last = `${year}-12-31`
      for (; day <= last; day = calendarDayShift(day, 1)) {
        const previous = map.get(day) ?? { count: 0, colors: new Set<string>() }
        previous.count++
        previous.colors.add(
          calendars.find((c) => c.id === item.event.calendarId)?.color ??
            "#7866d5"
        )
        map.set(day, previous)
      }
    }
    return map
  }, [items, zone, year, calendars])
  return (
    <div className="bordena-year" data-calendar-year={year}>
      <div className="bordena-year-months">
        {stats.map((m) => {
          const first = (calendarWeekday(m.day) - weekStart + 7) % 7,
            next = calendarDayShift(m.day, 32).slice(0, 7) + "-01",
            last = Number(calendarDayShift(next, -1).slice(8))
          return (
            <section
              className="bordena-mini-month"
              key={m.month}
              aria-label={dateFormat.format(new Date(m.day + "T12:00"))}
            >
              <button
                className="bordena-mini-title"
                onClick={() => onMonth(m.day)}
              >
                {dateFormat.format(new Date(m.day + "T12:00"))}
                <span aria-hidden>›</span>
              </button>
              <div className="bordena-mini-grid">
                {Array.from({ length: 7 }, (_, i) => (
                  <span className="text-muted-foreground" key={"w" + i}>
                    {new Intl.DateTimeFormat(locale, {
                      weekday: "narrow",
                    }).format(
                      new Date(
                        calendarDayShift("2026-10-25", (weekStart + i) % 7) +
                          "T12:00"
                      )
                    )}
                  </span>
                ))}
                {Array.from({ length: first }, (_, i) => (
                  <span key={"blank" + i} />
                ))}
                {Array.from({ length: last }, (_, i) => {
                  const day =
                      m.day.slice(0, 8) + String(i + 1).padStart(2, "0"),
                    entry = busyDays.get(day),
                    count = entry?.count ?? 0
                  return (
                    <button
                      key={day}
                      data-year-day={day}
                      data-today={day === current || undefined}
                      data-busy={count > 0 || undefined}
                      title={`${day} · ${count}`}
                      aria-label={new Intl.DateTimeFormat(locale, {
                        dateStyle: "full",
                      }).format(new Date(day + "T12:00"))}
                      onClick={() => onDay(day)}
                    >
                      {i + 1}
                      {count > 0 && (
                        <span aria-hidden className="bordena-mini-colors">
                          {[...(entry?.colors ?? [])]
                            .slice(0, 3)
                            .map((color) => (
                              <span
                                className="bordena-mini-dot"
                                key={color}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <details className="bordena-year-chart" open>
        <summary>{t("Загруженность по месяцам")}</summary>
        <div className="flex flex-wrap items-center gap-3 py-3">
          <label>
            {t("Показатель")}{" "}
            <select
              aria-label={t("Показатель")}
              className="rounded border bg-background p-2"
              value={effective}
              onChange={(e) => setMetric(e.target.value as typeof metric)}
            >
              <option value="busyHours">{t("Занятое время — часы")}</option>
              <option value="plannedHours">
                {t("Сумма запланированных часов")}
              </option>
              <option value="deadlineCount">{t("Задачи со сроками")}</option>
              <option value="eventCount">{t("Календарные события")}</option>
            </select>
          </label>
        </div>
        <div className="bordena-year-bars">
          {stats.map((m) => {
            const v = m[effective],
              name = dateFormat.format(new Date(m.day + "T12:00")),
              value = v === null ? t("Нет доступного времени") : fmt(v),
              label = `${name}: ${value}`
            return (
              <button
                key={m.month}
                className="bordena-year-bar"
                data-month-stat={m.month + 1}
                data-value={v ?? ""}
                title={label}
                aria-label={label}
                onClick={() => onMonth(m.day)}
              >
                <span>{value}</span>
                <span className="bordena-year-bar-track">
                  <span
                    style={{
                      height:
                        v === null ? 0 : `${Math.max(0, (v / maximum) * 100)}%`,
                    }}
                  />
                </span>
                <span>
                  {new Intl.DateTimeFormat(locale, { month: "short" }).format(
                    new Date(m.day + "T12:00")
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "План, не фактически отработанное время. События на весь день и сроки не добавляют часы."
          )}
        </p>
      </details>
    </div>
  )
}
