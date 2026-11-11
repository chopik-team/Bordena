import { Draggable, Droppable } from "@hello-pangea/dnd"
import { Link2 } from "lucide-react"
import { useT } from "@bordena/i18n"
import {
  useCard,
  useCardCol,
  useDashboards,
  useBoard,
  useUpdateCard,
  cardAxes,
  type Dashboard,
  type Column,
} from "@bordena/core"
import { useLocation } from "wouter"
import { Card } from "./card"
import { Button } from "@bordena/ui-kit"
import { applyOperations } from "@/lib/exchange/changeset"
import { reportError } from "@bordena/core"
import { useMutation } from "@tanstack/react-query"
export function MirrorList({
  dashboard,
  column,
  axes,
}: {
  dashboard: Dashboard
  column: Column
  axes?: { stageId: string; stateId: string }
}) {
  const t = useT(),
    mirrors = (dashboard.mirrors ?? [])
      .filter((m) => {
        if (!axes || !dashboard.layout) return m.columnId === column.id
        const placement = cardAxes(m, dashboard.layout)
        return (
          placement.stageId === axes.stageId &&
          placement.stateId === axes.stateId
        )
      })
      .sort(
        (a, b) =>
          a.position.localeCompare(b.position) || a.id.localeCompare(b.id)
      )
  return (
    <Droppable
      droppableId={
        axes
          ? `mirror-matrix|${axes.stageId}|${axes.stateId}`
          : `mirrors:${column.id}`
      }
      type="MIRROR"
    >
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={dashboard.mirrors?.length ? "min-h-10" : ""}
        >
          {!!mirrors.length && (
            <div className="py-1 text-xs text-muted-foreground">
              {t("Зеркала")}
            </div>
          )}
          {mirrors.map((mirror, index) => (
            <Draggable
              key={mirror.id}
              draggableId={`mirror:${mirror.id}`}
              index={index}
              isDragDisabled={!!axes}
            >
              {(drag) => (
                <div
                  ref={drag.innerRef}
                  {...drag.draggableProps}
                  {...drag.dragHandleProps}
                >
                  <MirrorTile
                    dashboard={dashboard}
                    mirror={mirror}
                    column={column}
                  />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}
function MirrorTile({
  dashboard,
  mirror,
  column,
}: {
  dashboard: Dashboard
  mirror: NonNullable<Dashboard["mirrors"]>[number]
  column: Column
}) {
  const t = useT(),
    { data: source } = useCard(mirror.sourceCardId)
  const { mutate: save } = useUpdateCard(mirror.sourceCardId)
  const { data: sourceColumn } = useCardCol(mirror.sourceCardId),
    [, navigate] = useLocation()
  const { data: dashboards } = useDashboards()
  const { data: targetBoard } = useBoard(dashboard.id)
  const sourceBoard = dashboards?.find(
    (d) => d.id === sourceColumn?.dashboardId
  )
  const placement = dashboard.layout ? cardAxes(mirror, dashboard.layout) : null
  const { mutate: move, isPending } = useMutation({
    mutationFn: (
      patch: Partial<Pick<typeof mirror, "columnId" | "stageId" | "stateId">>
    ) =>
      applyOperations([
        {
          op: "move-mirror",
          id: mirror.id,
          boardId: dashboard.id,
          expectedUpdatedAt: dashboard.updatedAt,
          patch,
        },
      ]),
    onError: reportError,
  })
  const remove = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        void applyOperations([
          {
            op: "remove-mirror",
            id: mirror.id,
            boardId: dashboard.id,
            expectedUpdatedAt: dashboard.updatedAt,
          },
        ]).catch(reportError)
      }
    >
      {t("Удалить зеркало")}
    </Button>
  )
  return (
    <div
      className="rounded-lg border border-dashed p-1"
      data-mirror-id={mirror.id}
    >
      <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
        <Link2 className="size-4" />
        {t("Зеркало")}
        {remove}
      </div>
      <details className="px-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer py-1">
          {t("Положение зеркала")}
        </summary>
        <div className="flex flex-wrap gap-2 py-2">
          <label>
            {t("Секция")}
            <select
              aria-label={t("Секция зеркала")}
              disabled={isPending}
              className="ml-1 max-w-40 rounded border bg-background p-1"
              value={mirror.columnId}
              onChange={(event) => move({ columnId: event.target.value })}
            >
              {(targetBoard?.columns ?? []).map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </label>
          {dashboard.layout &&
            placement &&
            (["stageId", "stateId"] as const).map((field) => (
              <label key={field}>
                {t(field === "stageId" ? "Этап" : "Состояние")}
                <select
                  aria-label={t(
                    field === "stageId" ? "Этап зеркала" : "Состояние зеркала"
                  )}
                  disabled={isPending}
                  className="ml-1 max-w-40 rounded border bg-background p-1"
                  value={placement[field]}
                  onChange={(event) => move({ [field]: event.target.value })}
                >
                  {dashboard.layout![
                    field === "stageId" ? "stages" : "states"
                  ].map((axis) => (
                    <option key={axis.id} value={axis.id}>
                      {axis.title}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
      </details>
      {source && !source.deletedAt ? (
        <Card
          card={source}
          layout={sourceBoard?.layout}
          column={sourceColumn ?? column}
          showBody
          isDragging={false}
          onClick={() =>
            sourceColumn &&
            navigate(`~/d/${sourceColumn.dashboardId}/c/${source.id}`)
          }
          onPatch={(_id, patch) => save(patch)}
        />
      ) : (
        <p className="p-3 text-sm">{t("Исходная карточка недоступна")}</p>
      )}
    </div>
  )
}
