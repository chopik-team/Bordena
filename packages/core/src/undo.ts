import type { TrashKind } from "./api/operations"

/** A deletion that ⌘Z can take back. */
export interface UndoEntry {
  kind: TrashKind
  id: string
}

/**
 * Deletions made in this session, newest last. In memory only: reloading drops
 * the stack, and the trash view is the durable way back. Restoring is
 * idempotent, so an entry undone from the trash first is harmless to pop.
 */
const stack: UndoEntry[] = []

const LIMIT = 50

export function pushUndo(kind: TrashKind, id: string): void {
  stack.push({ kind, id })
  if (stack.length > LIMIT) stack.shift()
}

export function popUndo(): UndoEntry | undefined {
  return stack.pop()
}
