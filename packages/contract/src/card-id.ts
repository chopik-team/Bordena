/**
 * Card-id helpers shared by the client and the MCP server, kept here so both
 * compose and parse display ids the same way.
 */

/**
 * The human-readable card id (the `12` in `[[12]]`), or `null` when the card
 * has no `number` yet — the server stamps it on first sync.
 */
export function cardDisplayId(number?: number | null): string | null {
  if (number == null) return null
  return String(number)
}

/**
 * The card number a `[[…]]` reference points at, or `null` when the text isn't
 * one. Ids used to carry a board prefix, so anything up to a dash is dropped:
 * `[[ROAD-12]]` written before that went away still resolves to 12.
 */
export function refNumber(text: string): number | null {
  const match = /^(?:[A-Za-z0-9]*-)?(\d+)$/.exec(text.trim())
  return match ? Number(match[1]) : null
}
