import { useMutation, useQueryClient } from "@tanstack/react-query"
import { publishBoard, unpublishBoard } from "../../api/boards"
import { keys } from "../keys"

/** Both writes change what `usePublicBoardStatus` would answer, and the list's
 * marker with it, and nothing else — the board record does not carry the token. */
function useRefetchStatus(boardId: string) {
  const qc = useQueryClient()
  return async () => {
    await qc.invalidateQueries({ queryKey: keys.publicStatus(boardId) })
    await qc.invalidateQueries({ queryKey: keys.publishedBoards })
  }
}

export function usePublishBoard(boardId: string) {
  const refetch = useRefetchStatus(boardId)
  return useMutation({
    mutationFn: () => publishBoard(boardId),
    onSuccess: refetch,
  })
}

export function useUnpublishBoard(boardId: string) {
  const refetch = useRefetchStatus(boardId)
  return useMutation({
    mutationFn: () => unpublishBoard(boardId),
    onSuccess: refetch,
  })
}
