import { useMutation } from "@tanstack/react-query"
import { keys, queryClient, type BoardLayout } from "@bordena/core"
import { changeLayout } from "../layout-workspace"
export function useLayoutChange(id: string) {
  return useMutation({
    mutationFn: (update: (layout: BoardLayout) => BoardLayout) =>
      changeLayout(id, update),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: keys.dashboards }),
  })
}
