import { useT } from "@bordena/i18n"
import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { X } from "lucide-react"
import { cn } from "./lib/cn"
import { useIsMobile } from "./lib/use-mobile"
import type { DateInputCalendarProps } from "./date-input-calendar"
import { Input } from "./input"
const DateInputCalendar = React.lazy(() => import("./date-input-calendar"))
interface DateInputProps {
  value: string | null
  onChange?: (value: string | null) => void
  /**
   * The clickable element. On desktop it opens a calendar popover; on mobile
   * the OS-native date picker is layered on top for a native experience.
   */
  children: React.ReactNode
  className?: string
  /** Forwarded to the native `<input type="date">` (min/max, disabled, …). */
  inputProps?: Omit<
    React.ComponentProps<"input">,
    "type" | "value" | "onChange" | "className"
  >
  /** Extra props for the desktop `<Calendar>` (disabled days, locale, …). */
  calendarProps?: DateInputCalendarProps["calendarProps"]
  /** Use Bordena's date + optional time calendar at every window width. */
  withTime?: boolean
}
/**
 * A date picker that adapts to the viewport: a calendar popover on large
 * screens, and the OS-native date input on small screens. The `value` is an
 * ISO `yyyy-MM-dd` string (or `null`). The calendar is loaded lazily, so it is
 * never fetched on mobile.
 */
function DateInput({
  value,
  onChange,
  children,
  className,
  inputProps,
  calendarProps,
  withTime,
}: DateInputProps) {
  const t = useT()
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  if (isMobile && !withTime) {
    return (
      <span className={cn("relative inline-flex overflow-hidden", className)}>
        {children}
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value || null)}
          onClick={(e) => e.currentTarget.showPicker?.()}
          className="absolute inset-0 cursor-pointer opacity-0"
          {...inputProps}
        />
        {value && (
          <button
            type="button"
            aria-label={t("Убрать дату")}
            onClick={(e) => {
              e.stopPropagation()
              onChange?.(null)
            }}
            className="relative z-10 rounded-full p-1 text-muted-foreground md:p-0.5 hover:text-foreground"
          >
            <X className="size-4 md:size-3.5" />
          </button>
        )}
      </span>
    )
  }
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-label={inputProps?.["aria-label"]}
        title={inputProps?.title}
        disabled={inputProps?.disabled}
        className={cn("inline-flex", className)}
      >
        {children}
      </PopoverPrimitive.Trigger>
      {open && (
        <React.Suspense fallback={null}>
          <DateInputCalendar
            value={value}
            onSelect={(next) => {
              onChange?.(next)
              setOpen(false)
            }}
            calendarProps={calendarProps}
            withTime={withTime}
          />
        </React.Suspense>
      )}
    </PopoverPrimitive.Root>
  )
}
export { DateInput }
