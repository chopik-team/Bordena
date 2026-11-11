import { useMutation, useQueryClient } from "@tanstack/react-query"
import * as membersApi from "../../api/members"
import { keys } from "../keys"

/** A membership write changes the roster and whether the board counts as
 * shared; the board itself arrives or leaves on the next sync tick. */
function useRefetchMembers(boardId: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: keys.members(boardId) })
    qc.invalidateQueries({ queryKey: keys.sharedBoards })
  }
}

export function useAddMember(boardId: string) {
  const refetch = useRefetchMembers(boardId)
  return useMutation({
    mutationFn: (userId: string) => membersApi.addMember(boardId, userId),
    onSuccess: refetch,
  })
}

export function useRemoveMember(boardId: string) {
  const refetch = useRefetchMembers(boardId)
  return useMutation({
    mutationFn: (userId: string) => membersApi.removeMember(boardId, userId),
    onSuccess: refetch,
  })
}
