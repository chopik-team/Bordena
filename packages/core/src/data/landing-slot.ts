import { useCallback, useEffect, useState } from "react"
import type { Card } from "../types"

export interface Landing {
  cardId: string
  columnId: string
  index: number
}

/**
 * Holds a dropped card at the slot it was dropped in for as long as the drop
 * animation runs, so a sort that is about to move it elsewhere does not yank it
 * out from under the finger. `holdMs` is that animation's length.
 */
export function useLandingSlot(enabled: boolean, holdMs: number) {
  const [landing, setLanding] = useState<Landing | null>(null)

  useEffect(() => {
    if (!landing) return
    const timer = setTimeout(() => setLanding(null), holdMs)
    return () => clearTimeout(timer)
  }, [landing, holdMs])

  // Stable: a drop handler may be memoised on it.
  const hold = useCallback(
    (next: Landing) => {
      if (!enabled) return
      setLanding(next)
    },
    [enabled]
  )

  const release = useCallback((cardId: string) => {
    setLanding((current) => (current?.cardId === cardId ? null : current))
  }, [])

  function place(cards: Card[], columnId: string): Card[] {
    if (!landing || landing.columnId !== columnId) return cards
    const from = cards.findIndex((card) => card.id === landing.cardId)
    if (from === -1) return cards
    const next = [...cards]
    const [moved] = next.splice(from, 1)
    next.splice(landing.index, 0, moved)
    return next
  }

  return { hold, release, place }
}
