/**
 * Records ordered within a column/board carry a fractional-index `position`: a
 * string key that sorts lexicographically. To move a record you mint a key
 * *between* its new neighbors (see `fractional-indexing`), so a reorder touches
 * only the moved record instead of renumbering the whole list — which is what
 * lets two users reorder the same board concurrently without clobbering each
 * other's positions.
 */

import { generateKeyBetween } from "fractional-indexing"

/** Comparator that orders records by their fractional `position` key. */
export function byPosition<T extends { position: string }>(a: T, b: T): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0
}

/**
 * The key for a record dropped between `before` and `after`, or null if there
 * is no room for one. `generateKeyBetween` throws when the two neighbours carry
 * the same position, which should not happen and yet does — and because a drop
 * handler may be async, the throw surfaces only as an unhandled rejection
 * reading `Error:  >= `. Named here instead, with the records that collided.
 */
export function keyBetween<T extends { id: string; position: string }>(
  before?: T,
  after?: T
): string | null {
  try {
    return generateKeyBetween(before?.position ?? null, after?.position ?? null)
  } catch {
    console.warn(
      `[board] no key between ${before?.id}@${before?.position} and ${after?.id}@${after?.position} — drop ignored`
    )
    return null
  }
}
