import { useCallback, useEffect, useRef } from "react"
import type { DropResult } from "@hello-pangea/dnd"

/** The list sensor handles lifting/reordering; cell hit-testing supplies the second grid axis. */
export function matrixPointerDestination(
  surface: Element,
  x: number,
  y: number,
  draggedId: string
) {
  const cell = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-matrix-cell]")
  if (!cell || !surface.contains(cell) || cell.dataset.collapsed === "true")
    return null
  const cards = [
    ...cell.querySelectorAll<HTMLElement>("[data-rfd-draggable-id]"),
  ].filter((el) => el.dataset.rfdDraggableId !== draggedId)
  const index = cards.filter((el) => {
    const rect = el.getBoundingClientRect()
    return y > rect.y + rect.height / 2
  }).length
  return { droppableId: `matrix|${cell.dataset.matrixCell}`, index }
}

export function useMatrixTarget(enabled: boolean, dragging: boolean) {
  const point = useRef<{ x: number; y: number } | null>(null)
  const highlighted = useRef<HTMLElement | null>(null)
  const clear = useCallback(() => {
    highlighted.current?.removeAttribute("data-pointer-target")
    highlighted.current = null
  }, [])
  useEffect(() => {
    if (!enabled) return
    const move = (e: PointerEvent) => {
      point.current = { x: e.clientX, y: e.clientY }
      if (!dragging) return
      const cell = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-matrix-cell]")
      clear()
      if (cell && cell.dataset.collapsed !== "true") {
        cell.setAttribute("data-pointer-target", "true")
        highlighted.current = cell
      }
    }
    const blur = () => {
      point.current = null
      clear()
    }
    window.addEventListener("pointermove", move, true)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("pointermove", move, true)
      window.removeEventListener("blur", blur)
      clear()
    }
  }, [enabled, dragging, clear])
  return (result: DropResult): DropResult => {
    clear()
    if (
      !enabled ||
      result.mode !== "FLUID" ||
      result.reason !== "DROP" ||
      !point.current
    )
      return result
    const surface = document.querySelector("[data-matrix]")
    if (!surface) return result
    const destination = matrixPointerDestination(
      surface,
      point.current.x,
      point.current.y,
      result.draggableId
    )
    point.current = null
    // A pointer outside the grid cancels the move even if the list sensor retains an old target.
    return { ...result, destination }
  }
}
