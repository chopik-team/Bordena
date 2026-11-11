import { useMutation, useQuery } from "@tanstack/react-query"
import { keys, queryClient } from "@bordena/core"
import { readOrganization } from "../workspaces"
export function useOrganization() {
  return useQuery({
    queryKey: [...keys.sidebar, "organization"],
    queryFn: readOrganization,
    networkMode: "always",
  })
}
export function useOrganizationAction() {
  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: keys.dashboards }),
  })
}
