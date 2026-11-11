import { Popover, Button } from "@bordena/ui-kit"
import { useT } from "@bordena/i18n"
import { ChevronDown, Pencil, Plus, X } from "lucide-react"
import type { BordenaCalendar } from "@bordena/contract"
import { GENERAL_CALENDAR_ID } from "@bordena/contract"

/** One management surface; visibility never changes the target for new entries. */
export function CalendarPicker({
  calendars,
  selected,
  onSelect,
  onEdit,
  onCreate,
  onVisibility,
}: {
  calendars: BordenaCalendar[]
  selected: string
  onSelect: (id: string) => void
  onEdit: (calendar: BordenaCalendar) => void
  onCreate: () => void
  onVisibility: (id: string, visible: boolean) => void
}) {
  const t = useT()
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="secondary" size="sm" />}>
        {t("Все календари")}{" "}
        <span className="text-muted-foreground">
          {calendars.filter((c) => c.visible).length}/{calendars.length}
        </span>
        <ChevronDown />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className="max-h-[75vh] w-80 max-w-[calc(100vw-24px)] overflow-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none">
            <div className="mb-3 flex items-center justify-between">
              <Popover.Title className="font-semibold">
                {t("Календари")}
              </Popover.Title>
              <Popover.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("Закрыть")}
                  />
                }
              >
                <X />
              </Popover.Close>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("Общий календарь объединяет все записи без дубликатов.")}
            </p>
            {calendars.map((c) => (
              <div className="flex min-w-0 items-center gap-2 py-1" key={c.id}>
                <input
                  type="checkbox"
                  aria-label={t("Видимость: {title}", { title: c.title })}
                  checked={
                    c.id === GENERAL_CALENDAR_ID
                      ? calendars.every((x) => x.visible)
                      : c.visible
                  }
                  ref={(el) => {
                    if (el && c.id === GENERAL_CALENDAR_ID)
                      el.indeterminate =
                        calendars.some((x) => x.visible) &&
                        !calendars.every((x) => x.visible)
                  }}
                  onChange={(e) => onVisibility(c.id, e.target.checked)}
                />
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span
                  title={c.title}
                  className="min-w-0 flex-1 truncate text-sm"
                >
                  {c.title}
                </span>
                <Popover.Close
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("Настройки: {title}", { title: c.title })}
                      onClick={() => onEdit(c)}
                    />
                  }
                >
                  <Pencil />
                </Popover.Close>
              </div>
            ))}
            <label className="mt-3 block text-sm">
              {t("Для новых событий")}
              <select
                aria-label={t("Для новых событий")}
                className="mt-1 w-full min-w-0 truncate rounded border bg-background p-2"
                value={selected === "all" ? GENERAL_CALENDAR_ID : selected}
                onChange={(e) => onSelect(e.target.value)}
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Выбор для создания не меняет видимость.")}
            </p>
            <Popover.Close
              render={
                <Button
                  variant="ghost"
                  className="mt-3 w-full"
                  onClick={onCreate}
                />
              }
            >
              <Plus />
              {t("Добавить календарь")}
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
