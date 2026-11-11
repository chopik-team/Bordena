import { useEffect } from "react"
import type { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { isDesktop } from "@/lib/platform"

/** Height of the draggable strip in px. */
const DRAG_STRIP_HEIGHT = 60

/** Drag detection threshold */
const DRAG_THRESHOLD = 4

/**
 * Makes the top strip of the window drag the OS window
 */
export function WindowDragRegion() {
  useEffect(() => {
    if (!isDesktop()) return

    let win: WebviewWindow | null = null
    let cancelled = false
    void import("@tauri-apps/api/webviewWindow").then(
      ({ getCurrentWebviewWindow }) => {
        if (!cancelled) win = getCurrentWebviewWindow()
      }
    )

    let armed = false

    function onMouseDown(e: MouseEvent) {
      armed = false
      if (!win || e.button !== 0 || e.clientY > DRAG_STRIP_HEIGHT) return
      const el = e.target as HTMLElement
      if (el.closest("[data-no-drag]")) return
      // Let an already-focused text field be dragged for text selection; the
      // first click still focuses it (no movement = no drag).
      const field = el.closest("input, textarea")
      if (field && field === document.activeElement) return

      const startX = e.clientX
      const startY = e.clientY

      function onMove(ev: MouseEvent) {
        if (
          Math.abs(ev.clientX - startX) < DRAG_THRESHOLD &&
          Math.abs(ev.clientY - startY) < DRAG_THRESHOLD
        )
          return
        cleanup()
        armed = true
        void win?.startDragging()
      }

      function cleanup() {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", cleanup)
      }

      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", cleanup)
    }

    function onClickCapture(ev: MouseEvent) {
      if (!armed) return
      armed = false
      ev.stopPropagation()
      ev.preventDefault()
    }

    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("click", onClickCapture, true)
    return () => {
      cancelled = true
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [])

  return null
}
