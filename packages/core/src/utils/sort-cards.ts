import { priorityRank } from "@bordena/tokens"
import type { Card } from "../types"
import { byPosition } from "./position"
export type SortKey = "priority" | "deadline" | "progress"
/** The sort modes a board offers, in the order they are listed to a person. */
export const SORT_MODES: {
  id: SortKey
  label: string
}[] = [
  { id: "priority", label: "Приоритет" },
  { id: "deadline", label: "Срок" },
  { id: "progress", label: "Готовность" },
]
function byDeadline(a: Card, b: Card): number {
  if (a.deadline === b.deadline) return 0
  if (a.deadline === null) return 1
  if (b.deadline === null) return -1
  return a.deadline < b.deadline ? -1 : 1
}
const comparators: Record<SortKey, (a: Card, b: Card) => number> = {
  priority: (a, b) => priorityRank(a.priority) - priorityRank(b.priority),
  deadline: byDeadline,
  progress: (a, b) =>
    a.progress == null
      ? b.progress == null
        ? 0
        : 1
      : b.progress == null
        ? -1
        : a.progress - b.progress,
}
function isSortKey(key: string): key is SortKey {
  return key in comparators
}
/** Two cards the sort cannot tell apart, so their order is theirs to pick. */
export type ProgressReader = (card: Card) => number | null | undefined
function compare(key: SortKey, a: Card, b: Card, progress?: ProgressReader) {
  if (key !== "progress" || !progress) return comparators[key](a, b)
  const left = progress(a),
    right = progress(b)
  return left == null
    ? right == null
      ? 0
      : 1
    : right == null
      ? -1
      : left - right
}
export function sameSortGroup(
  a: Card,
  b: Card,
  keys: string[],
  progress?: ProgressReader
): boolean {
  return keys
    .filter(isSortKey)
    .every((key) => compare(key, a, b, progress) === 0)
}
/**
 * The cards a dropped card is written between. Under a sort only the cards it
 * ties with can hold it in place — a position between two cards the sort ranks
 * apart is undone the moment the list re-sorts.
 *
 * `order` is the destination column as rendered, minus the moved card, so
 * `index` is the slot the card was let go in.
 */
export function dropNeighbours(
  order: Card[],
  index: number,
  moved: Card,
  keys: string[],
  progress?: ProgressReader
): [Card | undefined, Card | undefined] {
  const tied = order
    .map((card, at) => ({ card, at }))
    .filter((entry) => sameSortGroup(entry.card, moved, keys, progress))
  const prev = tied.filter((entry) => entry.at < index).at(-1)?.card
  const next = tied.find((entry) => entry.at >= index)?.card
  if (!prev && !next) return [undefined, order[0]]
  return [prev, next]
}
/** Nothing written on it yet — a card just added, which no key can rank. */
function isBlank(card: Card): boolean {
  return card.title.trim() === "" && card.body.trim() === ""
}
export function sortCards(
  cards: Card[],
  keys: string[],
  progress?: ProgressReader
): Card[] {
  const active = keys.filter(isSortKey)
  if (active.length === 0) return cards
  return [...cards].sort((a, b) => {
    if (isBlank(a) !== isBlank(b)) return isBlank(a) ? -1 : 1
    for (const key of active) {
      const order = compare(key, a, b, progress)
      if (order !== 0) return order
    }
    return byPosition(a, b)
  })
}
