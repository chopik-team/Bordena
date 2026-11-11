import type { ReactNode } from "react"
import { cn } from "../lib/cn"

export function MdTableCell({
  header,
  align,
  children,
}: {
  header?: boolean
  align?: "left" | "center" | "right" | null
  children: ReactNode
}) {
  const className = cn(
    "border border-border px-2.5 py-1.5 text-left",
    header && "bg-muted/50 font-semibold"
  )
  const style = align ? { textAlign: align } : undefined
  if (header)
    return (
      <th className={className} style={style}>
        {children}
      </th>
    )
  return (
    <td className={className} style={style}>
      {children}
    </td>
  )
}
