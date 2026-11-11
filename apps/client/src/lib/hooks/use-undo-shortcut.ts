import { useEffect } from "react"
import { useRestore, popUndo } from "@bordena/core"
import { historyAction } from "../structural-history"
import { reportError } from "@bordena/core"

/** Text fields own their own undo history; ⌘Z there must not reach the board. */
function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  )
}

/**
 * Maps ⌘Z / Ctrl+Z to taking back the last deletion of this session. Only
 * deletions: everything else the app writes is either trivially redone or lives
 * in a text field with its own undo.
 */
export function useUndoShortcut() {
  const { mutate: restore } = useRestore()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() !== "z") return
      if (isEditing(e.target)) return

      e.preventDefault()
      void historyAction(e.shiftKey ? "redo" : "undo")
        .then((handled) => {
          if (!handled && !e.shiftKey) {
            const entry = popUndo()
            if (entry) restore(entry)
          }
        })
        .catch(reportError)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [restore])
}
