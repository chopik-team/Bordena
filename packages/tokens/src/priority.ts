export interface Priority {
  /** Stored on the card; `""` means none. */
  id: string
  label: string
}

/** The importance levels a card can carry, most important first. */
export const PRIORITIES: Priority[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
]

/** The web takes medium's amber from Tailwind classes; native needs the value
 * itself. Same pair as `DEADLINE.soonForeground`, which sits beside it on a card. */
export const PRIORITY = {
  light: { medium: "#d97706" },
  dark: { medium: "#fbbf24" },
} as const

/**
 * Sort key: high 0, medium 1, low 2, unset or retired last. Takes `undefined`
 * because cards stored locally before the field existed read back without it —
 * a client only regains the key when the card is rewritten and pulled back.
 */
export function priorityRank(id: string | undefined): number {
  const index = PRIORITIES.findIndex((p) => p.id === id)
  return index === -1 ? PRIORITIES.length : index
}
