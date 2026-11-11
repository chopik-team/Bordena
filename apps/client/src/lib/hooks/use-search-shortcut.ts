import { useEffect } from "react"

/**
 * Maps ⌘K / Ctrl+K to opening the board's search overlay. Unlike ⌘Z, it fires
 * inside text fields too: ⌘K edits no text, so there is nothing to shadow.
 */
export function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return
      if (e.key.toLowerCase() !== "k") return
      e.preventDefault()
      onOpen()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onOpen])
}
