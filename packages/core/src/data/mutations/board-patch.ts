import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Board } from "../../types"
import { keys } from "../keys"
import { flushSyncUpdate } from "./flush-sync"

interface BoardPatchOptions<V> {
  /** Rewrites the cached board before the write lands. */
  apply: (board: Board, vars: V) => Board
  /**
   * Commit inside the calling event rather than a frame later — see
   * {@link flushSyncUpdate}. Only the drag handlers need it.
   */
  flush?: boolean
  /** Extra keys to invalidate on settle, beyond the board itself. */
  also?: (vars: V) => readonly (readonly unknown[])[]
}

/**
 * A board mutation that writes its result into the board cache up front, so the
 * change is instant, rolls back on error, then reconciles on settle.
 */
export function useBoardPatch<V>(
  deckId: string,
  mutationFn: (vars: V) => Promise<unknown>,
  { apply, flush, also }: BoardPatchOptions<V>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    // Synchronous on purpose (no awaited `cancelQueries`): a flushed write has
    // to land within the event that triggered it.
    onMutate: (vars: V) => {
      const previous = qc.getQueryData<Board>(keys.board(deckId))
      if (previous) {
        const next = apply(previous, vars)
        const write = () => qc.setQueryData(keys.board(deckId), next)
        if (flush) flushSyncUpdate(write)
        else write()
      }
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.board(deckId), ctx.previous)
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: keys.board(deckId) })
      for (const key of also?.(vars) ?? [])
        qc.invalidateQueries({ queryKey: key })
    },
  })
}

/** Swaps the changed rows in by id, leaving the rest — and the order — alone. */
export function replaceById<T extends { id: string }>(
  rows: T[],
  changed: T[]
): T[] {
  const updates = new Map(changed.map((row) => [row.id, row]))
  return rows.map((row) => updates.get(row.id) ?? row)
}
