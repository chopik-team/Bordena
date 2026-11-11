import { useEffect, useState } from "react"
import { isDesktop } from "@/lib/platform"

/**
 * True while the desktop window is in native fullscreen, where the traffic
 * lights are hidden and nothing has to leave room for them. Always false on web.
 */
export function useIsFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!isDesktop()) return

    let cancelled = false
    let unlisten: (() => void) | undefined

    void import("@tauri-apps/api/webviewWindow").then(
      async ({ getCurrentWebviewWindow }) => {
        const win = getCurrentWebviewWindow()

        async function read() {
          const value = await win.isFullscreen()
          if (!cancelled) setFullscreen(value)
        }

        await read()
        // Entering or leaving fullscreen has no dedicated event; it always resizes.
        const stop = await win.onResized(() => void read())
        if (cancelled) stop()
        else unlisten = stop
      }
    )

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  return fullscreen
}
