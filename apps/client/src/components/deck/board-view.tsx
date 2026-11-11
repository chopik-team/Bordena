import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@bordena/ui-kit"
import { installBoardPan } from "@/lib/board-pan"

interface IProps {
  /** Omitted where the page around the board owns its top bar. */
  header?: ReactNode
  /** The columns. */
  children: ReactNode
  isLoading?: boolean
  /** Suppresses snapping, which fights a drag in progress. */
  isDragging?: boolean
  /** Pinned to the bottom-right corner — the sync indicator, where there is one. */
  footer?: ReactNode
  twoAxis?: boolean
  scrollKey?: string
}

/** The board: a header over a horizontal row of columns. */
export function BoardView({
  header,
  children,
  isLoading,
  isDragging,
  footer,
  twoAxis,
  scrollKey,
}: IProps) {
  const surface = useRef<HTMLDivElement>(null)
  useEffect(
    () => (surface.current ? installBoardPan(surface.current) : undefined),
    []
  )
  useEffect(() => {
    if (surface.current) {
      surface.current.scrollLeft = 0
      surface.current.scrollTop = 0
    }
  }, [scrollKey])
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {header}
      <div
        ref={surface}
        data-board-surface="true"
        data-board-dragging={isDragging ? "true" : undefined}
        className={cn(
          "flex min-h-0 w-full flex-1 gap-0 overscroll-x-contain px-0 xs:gap-6 xs:px-6",
          twoAxis
            ? "items-start overflow-auto"
            : "items-stretch overflow-x-auto overflow-y-hidden",
          !isDragging &&
            !isLoading &&
            "snap-x snap-mandatory scroll-px-0 xs:scroll-px-6 md:snap-none",
          "transition-opacity duration-1000",
          isLoading ? "opacity-0" : "opacity-100"
        )}
      >
        {children}
      </div>
      {footer && <div className="absolute right-4 bottom-4 z-50">{footer}</div>}
    </div>
  )
}
