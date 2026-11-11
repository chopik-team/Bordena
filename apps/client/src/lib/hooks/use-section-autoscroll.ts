import { useEffect } from "react"

export function edgeScrollDelta(
  position: number,
  start: number,
  end: number
): number {
  const edge = 48
  if (position < start || position > end) return 0
  if (position < start + edge)
    return -Math.ceil((16 * (start + edge - position)) / edge)
  if (position > end - edge)
    return Math.ceil((16 * (position - end + edge)) / edge)
  return 0
}
export function useSectionAutoScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    let point: { x: number; y: number } | null = null,
      frame = 0
    const move = (e: PointerEvent) => {
      point = { x: e.clientX, y: e.clientY }
    }
    const tick = () => {
      const surface = document.querySelector<HTMLElement>(
        "[data-board-surface]"
      )
      if (point && surface) {
        const rect = surface.getBoundingClientRect()
        surface.scrollLeft += edgeScrollDelta(point.x, rect.left, rect.right)
        // A floating tall section can cover the hit-test point. Its visual
        // geometry must not hide the stationary lane that needs scrolling.
        const lane =
          point.y >= rect.top && point.y <= rect.bottom
            ? [
                ...surface.querySelectorAll<HTMLElement>("[data-layout-lane]"),
              ].find((element) => {
                const box = element.getBoundingClientRect()
                return (
                  point!.x >= Math.max(box.left, rect.left) &&
                  point!.x <= Math.min(box.right, rect.right)
                )
              })
            : undefined
        if (lane) {
          const box = lane.getBoundingClientRect()
          lane.scrollTop += edgeScrollDelta(
            point.y,
            Math.max(box.top, rect.top),
            Math.min(box.bottom, rect.bottom)
          )
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const blur = () => {
      point = null
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("blur", blur)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("blur", blur)
    }
  }, [active])
}
