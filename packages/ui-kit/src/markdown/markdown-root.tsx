import type { ReactNode } from "react"
import { cn } from "../lib/cn"

export function MarkdownRoot({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative text-base leading-[1.6] break-words text-card-foreground",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      {children}
    </div>
  )
}
