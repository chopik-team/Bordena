import { useT } from "@bordena/i18n"
import { COLUMN_COLORS, cn } from "@bordena/ui-kit"
interface IProps {
  /** A column's stored color id; "" is the "no color" dot. */
  color: string
  className?: string
  /** Set only where the dot stands alone; beside a menu item's text it would repeat it. */
  labelled?: boolean
}
/**
 * A column's color as a dot. On the board it's labelled — with the picker
 * inside a menu, it's the only place the color shows.
 */
export function ColumnSwatch({ color, className, labelled }: IProps) {
  const t = useT()
  const current = COLUMN_COLORS.find((c) => c.id === color)
  const label = labelled
    ? t("Цвет секции: {p0}", {
        p0: current ? t(current.label) : t("Без цвета"),
      })
    : undefined
  return (
    <span
      role={labelled ? "img" : undefined}
      aria-label={label}
      className={cn(
        "size-3 shrink-0 rounded-full",
        !current && "border border-dashed border-muted-foreground/60",
        className
      )}
      style={
        current && {
          background: `oklch(0.72 0.14 ${current.hue})`,
          borderColor: `oklch(0.62 0.15 ${current.hue})`,
        }
      }
    />
  )
}
