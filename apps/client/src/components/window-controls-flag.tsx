import { useEffect } from "react"
import { hasOverlayTitleBar } from "@/lib/platform"
import { useIsFullscreen } from "@/lib/hooks"

/** Lets ui-kit pad for the traffic lights with `in-[.window-controls]:` without knowing about Tauri. */
export function WindowControlsFlag() {
  const isFullscreen = useIsFullscreen()

  useEffect(() => {
    if (!hasOverlayTitleBar() || isFullscreen) return
    document.documentElement.classList.add("window-controls")
    return () => document.documentElement.classList.remove("window-controls")
  }, [isFullscreen])

  return null
}
