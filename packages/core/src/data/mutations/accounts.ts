import { useMutation, useQueryClient } from "@tanstack/react-query"
import * as accountsApi from "../../api/accounts"
import { keys } from "../keys"

/** Every account mutation changes the list and nothing else. */
function useRefetchAccounts() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: keys.accounts })
}

export function useCreateAccount() {
  const refetch = useRefetchAccounts()
  return useMutation({
    mutationFn: ({ login, password }: { login: string; password: string }) =>
      accountsApi.createAccount(login, password),
    onSuccess: refetch,
  })
}

export function useSetAccountPassword() {
  const refetch = useRefetchAccounts()
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      accountsApi.setAccountPassword(id, password),
    onSuccess: refetch,
  })
}

export function useDeleteAccount() {
  const refetch = useRefetchAccounts()
  return useMutation({
    mutationFn: (id: string) => accountsApi.deleteAccount(id),
    onSuccess: refetch,
  })
}

export function useSetAccountActive() {
  const refetch = useRefetchAccounts()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      accountsApi.setAccountActive(id, active),
    onSuccess: refetch,
  })
}
