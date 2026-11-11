import type { CSSProperties } from "react"
import { cn, columnHue } from "@bordena/ui-kit"

interface IProps {
  title: string
  color: string
  className?: string
  isTinted?: boolean
}

/**
 * A column's title, tinted with the column's own color
 */
export function ColumnTag({
  title,
  color,
  className,
  isTinted = true,
}: IProps) {
  const hue = isTinted ? columnHue(color) : null
  return (
    <span
      style={hue === null ? undefined : ({ "--tag-h": hue } as CSSProperties)}
      className={cn(
        "shrink-0 whitespace-nowrap",
        "text-xs font-semibold tracking-[0.02em]",
        hue === null
          ? "text-muted-foreground"
          : [
              "text-[oklch(0.44_0.13_var(--tag-h))]",
              "dark:text-[oklch(0.84_0.11_var(--tag-h))]",
            ],
        className
      )}
    >
      {title}
    </span>
  )
}
