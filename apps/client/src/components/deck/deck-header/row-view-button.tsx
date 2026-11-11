import { useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  useDashboards,
  queryClient,
  keys,
  type DashboardView,
} from "@bordena/core"
import { ensureLayout } from "@/lib/layout-workspace"
import { ViewSwitcher } from "@/components/navigation/view-switcher"
export function RowViewButton({
  boardId,
  view,
  onChangeView,
}: {
  boardId: string
  view: DashboardView
  onChangeView: (view: DashboardView) => void
}) {
  const { data: boards = [] } = useDashboards()
  const dashboard = boards.find((b) => b.id === boardId)
  const mutation = useMutation({
    mutationFn: async (mode: "free" | "matrix") => {
      await ensureLayout(boardId, mode)
      onChangeView("board")
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: keys.dashboards }),
  })
  const choose = (value: string) => {
    if (value === "free" || value === "matrix") mutation.mutate(value)
    else onChangeView(value as DashboardView)
  }
  useEffect(() => {
    const action = (event: Event) => {
      const value = (event as CustomEvent<string>).detail
      if (value === "free" || value === "matrix") mutation.mutate(value)
      else if (["goal", "table", "rows", "board"].includes(value))
        onChangeView(value as DashboardView)
    }
    window.addEventListener("bordena:view", action)
    return () => window.removeEventListener("bordena:view", action)
  }, [onChangeView, mutation])
  return (
    <div className="bordena-board-views min-w-0">
      <ViewSwitcher
        label="Представление доски"
        value={view === "board" ? (dashboard?.layout?.mode ?? "free") : view}
        options={[
          { value: "free", label: "Свободная" },
          { value: "matrix", label: "Матрица" },
          { value: "table", label: "Таблица" },
          { value: "goal", label: "Путь к цели" },
          ...(view === "rows"
            ? [{ value: "rows", label: "Лента по датам" }]
            : []),
        ]}
        onChange={choose}
      />
      {mutation.isError && (
        <span role="alert" className="text-xs text-destructive">
          {mutation.error.message}
        </span>
      )}
    </div>
  )
}
