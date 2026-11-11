import { useCallback, useEffect, useRef } from "react"
import { runtime } from "../../runtime"
import { useSaveCard, type CardPatch } from "./card"

/** The card edited most recently, in any window; the desktop popup continues it. */
export const LAST_CARD_KEY = "bordena:last-card"

/** Long enough to coalesce a burst of typing, short enough to read as live. */
const SAVE_DELAY = 500
const flushers = new Set<() => Promise<void>>()
const writing = new Set<Promise<unknown>>()

/** Awaited by desktop close, so the debounce does not lose the last edit. */
export async function flushCardEdits(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()))
  await Promise.all([...writing])
}

/**
 * Debounced write-through for card edits, so the board card updates as you type.
 * The id travels with the patch: a queued write has to land on the card it was
 * typed into, even if the panel has since moved on to another one.
 */
export function useCardSave() {
  const { mutateAsync } = useSaveCard()
  const pending = useRef<{ id: string; patch: CardPatch } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const queued = pending.current
    pending.current = null
    if (queued) {
      const promise = mutateAsync(queued)
      writing.add(promise)
      promise.then(
        () => writing.delete(promise),
        () => writing.delete(promise)
      )
      await promise
    }
  }, [mutateAsync])

  const queue = useCallback(
    (id: string, patch: CardPatch) => {
      // Edits for a card we've navigated away from go out on their own.
      if (pending.current && pending.current.id !== id)
        void flush().catch(() => {})
      runtime().kv.set(LAST_CARD_KEY, id)
      pending.current = { id, patch: { ...pending.current?.patch, ...patch } }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush().catch(() => {}), SAVE_DELAY)
    },
    [flush]
  )

  useEffect(() => {
    flushers.add(flush)
    return () => {
      flushers.delete(flush)
      void flush().catch(() => {})
    }
  }, [flush])

  return { queue, flush }
}
