import { resolveValue, useToaster } from "react-hot-toast"
import type { Toast } from "react-hot-toast"
import type { CSSProperties, ReactNode } from "react"
import { useCallback, useState } from "react"

/** Undo toasts live in their own toaster so the pile never swallows the others. */
export const UNDO_TOASTER_ID = "undo"

const GUTTER = 8
/** Toasts deeper than this are fully transparent, so the pile never grows visually. */
const MAX_PEEK = 3
const PEEK_OFFSET = 8
const PEEK_SCALE = 0.04

function transform(offset: number, scale: number): string {
  return `translateX(-50%) translateY(${-offset}px) scale(${scale})`
}

interface ItemProps {
  id: string
  style: CSSProperties
  reachable: boolean
  onHeightUpdate: (id: string, height: number) => void
  children: ReactNode
}

function PileItem({
  id,
  style,
  reachable,
  onHeightUpdate,
  children,
}: ItemProps) {
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) onHeightUpdate(id, el.getBoundingClientRect().height)
    },
    [id, onHeightUpdate]
  )

  return (
    <div
      ref={ref}
      inert={!reachable}
      style={style}
      className={`absolute bottom-0 left-1/2 transition-[transform,opacity] duration-200 ease-out ${
        reachable ? "pointer-events-auto" : ""
      }`}
    >
      {children}
    </div>
  )
}

/**
 * Renders undo toasts as an overlapping pile
 */
export function UndoToaster() {
  const { toasts, handlers } = useToaster(undefined, UNDO_TOASTER_ID)
  const { startPause, endPause, updateHeight, calculateOffset } = handlers
  const [expanded, setExpanded] = useState(false)

  const visible = toasts.filter((t) => t.visible)

  function depthOf(t: Toast): number {
    const index = visible.indexOf(t)
    return index === -1 ? 0 : index
  }

  function placement(t: Toast, depth: number): CSSProperties {
    if (expanded) {
      const offset = calculateOffset(t, {
        gutter: GUTTER,
        defaultPosition: "bottom-center",
      })
      return { transform: transform(offset, 1), opacity: 1 }
    }
    return {
      transform: transform(depth * PEEK_OFFSET, 1 - depth * PEEK_SCALE),
      opacity: depth < MAX_PEEK ? 1 : 0,
    }
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[9999] h-0"
      onMouseEnter={() => {
        setExpanded(true)
        startPause()
      }}
      onMouseLeave={() => {
        setExpanded(false)
        endPause()
      }}
    >
      {toasts.map((t, index) => {
        const depth = depthOf(t)
        return (
          <PileItem
            key={t.id}
            id={t.id}
            reachable={expanded || depth === 0}
            onHeightUpdate={updateHeight}
            style={{
              ...placement(t, depth),
              transformOrigin: "bottom center",
              zIndex: toasts.length - index,
            }}
          >
            {resolveValue(t.message, t)}
          </PileItem>
        )
      })}
    </div>
  )
}
