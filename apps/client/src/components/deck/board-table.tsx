import { useState } from "react"
import { useLocation } from "wouter"
import { ColumnColorPicker } from "../column/column-color"
import { useT } from "@bordena/i18n"
import {
  cardAxes,
  type Board,
  type Dashboard,
  type Card,
  type CardPatch,
  type ProgressReader,
} from "@bordena/core"
import { routes } from "@/lib/routes"
import { Button, DateInput, formatDeadline } from "@bordena/ui-kit"
import { isCardOverdue } from "@/lib/deadlines"
import { updateDashboard } from "@/lib/layout-workspace"
import { queryClient, keys, reportError } from "@bordena/core"
import { useDeadlineClock } from "@/lib/hooks/use-deadline-clock"

export function BoardTable({
  dashboard,
  board,
  onPatch,
  progressOf,
}: {
  dashboard: Dashboard
  board: Board
  onPatch: (id: string, patch: CardPatch) => void
  progressOf: ProgressReader
}) {
  const t = useT(),
    [, navigate] = useLocation(),
    [query, setQuery] = useState(""),
    [overdue, setOverdue] = useState(false),
    [sort, setSort] = useState("title"),
    [descending, setDescending] = useState(false),
    [shown, setShown] = useState<string[]>(dashboard.tableFields ?? [])
  const fieldDefs = dashboard.fieldDefinitions ?? [],
    columns = new Map(board.columns.map((c) => [c.id, c]))
  const now = useDeadlineClock()
  const displayProgress = (card: Card) =>
    card.boardLink && card.boardLink.mode !== "navigation"
      ? card.linkedProgress?.value
      : progressOf(card)
  const value = (card: Card): string | number | boolean => {
    if (sort === "progress") return displayProgress(card) ?? -1
    if (sort === "priority")
      return (
        ({ high: 3, medium: 2, low: 1 } as Record<string, number>)[
          card.priority
        ] ?? 0
      )
    if (sort === "stageId" || sort === "stateId")
      return dashboard.layout ? cardAxes(card, dashboard.layout)[sort] : ""
    if (sort.startsWith("field:"))
      return card.fieldValues?.[sort.slice(6)] ?? ""
    return String(card[sort as keyof Card] ?? "")
  }
  const cards = board.cards
    .filter(
      (c) =>
        (!query ||
          `${c.title}\n${c.body}\n${c.tags.join(" ")}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())) &&
        (!overdue ||
          isCardOverdue(c, columns.get(c.columnId), now, dashboard.layout))
    )
    .sort((a, b) => {
      const left = value(a),
        right = value(b)
      return (
        (typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), undefined, {
              numeric: true,
            })) * (descending ? -1 : 1)
      )
    })
  const headers = [
    ["title", "Название"],
    ["stageId", "Этап"],
    ["stateId", "Состояние"],
    ["progress", "Прогресс"],
    ["priority", "Приоритет"],
    ["deadline", "Срок"],
    ["boardLink", "Связанная доска"],
    ...fieldDefs
      .filter((f) => shown.includes(f.id))
      .map((f) => [`field:${f.id}`, f.title]),
  ]
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          aria-label={t("Фильтр списка")}
          placeholder={t("Поиск в списке")}
          className="rounded border bg-background p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => setOverdue(e.target.checked)}
          />
          {t("Просрочено")}
        </label>
        {!!fieldDefs.length && (
          <details>
            <summary className="cursor-pointer text-sm">
              {t("Поля списка")}
            </summary>
            {fieldDefs.map((field) => (
              <label className="flex gap-2" key={field.id}>
                <input
                  type="checkbox"
                  checked={shown.includes(field.id)}
                  onChange={() => {
                    const next = shown.includes(field.id)
                      ? shown.filter((id) => id !== field.id)
                      : [...shown, field.id]
                    setShown(next)
                    void updateDashboard(dashboard.id, (board) => ({
                      ...board,
                      tableFields: next,
                    }))
                      .then(() =>
                        queryClient.invalidateQueries({
                          queryKey: keys.dashboards,
                        })
                      )
                      .catch(reportError)
                  }}
                />
                {field.title}
              </label>
            ))}
          </details>
        )}
      </div>
      <table className="w-full min-w-200 border-collapse text-sm">
        <thead>
          <tr>
            {headers.map(([key, label]) => (
              <th key={key} className="border-b p-2 text-left">
                <button
                  className="rounded py-2 focus-visible:outline-2"
                  onClick={() => {
                    if (sort === key) setDescending(!descending)
                    else {
                      setSort(key)
                      setDescending(false)
                    }
                  }}
                >
                  {key.startsWith("field:") ? label : t(label)}
                  {sort === key ? (descending ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const axes = dashboard.layout
              ? cardAxes(card, dashboard.layout)
              : null
            return (
              <tr key={card.id} className="border-b hover:bg-accent/40">
                <td className="max-w-80 p-2">
                  <span className="inline-flex align-middle">
                    <ColumnColorPicker
                      label={t("Цвет карточки")}
                      color={card.color ?? ""}
                      onChange={(color) => onPatch(card.id, { color })}
                    />
                  </span>
                  <button
                    className="text-left font-medium break-words focus-visible:outline-2"
                    onClick={() => navigate(routes.card.to(card.id))}
                  >
                    {card.title || t("Без названия")}
                  </button>
                </td>
                {(["stageId", "stateId"] as const).map((field) => (
                  <td className="p-2" key={field}>
                    {dashboard.layout && axes ? (
                      <select
                        aria-label={`${t(field === "stageId" ? "Этап" : "Состояние")}: ${card.title}`}
                        className="max-w-48 rounded border bg-background p-2"
                        value={axes[field]}
                        onChange={(e) =>
                          onPatch(card.id, { [field]: e.target.value })
                        }
                      >
                        {dashboard.layout[
                          field === "stageId" ? "stages" : "states"
                        ].map((axis) => (
                          <option key={axis.id} value={axis.id}>
                            {axis.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
                <td className="p-2">
                  {displayProgress(card) == null
                    ? "—"
                    : `${displayProgress(card)}%`}
                </td>
                <td className="p-2">
                  <select
                    aria-label={`${t("Приоритет")}: ${card.title}`}
                    className="rounded border bg-background p-2"
                    value={card.priority}
                    onChange={(e) =>
                      onPatch(card.id, { priority: e.target.value })
                    }
                  >
                    {["", "low", "medium", "high"].map((p) => (
                      <option value={p} key={p}>
                        {t(
                          p === "high"
                            ? "Высокий"
                            : p === "medium"
                              ? "Средний"
                              : p === "low"
                                ? "Низкий"
                                : "Без приоритета"
                        )}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <DateInput
                    withTime
                    value={card.deadline}
                    onChange={(deadline) => onPatch(card.id, { deadline })}
                    inputProps={{ "aria-label": `${t("Срок")}: ${card.title}` }}
                    className="rounded border px-3 py-2 hover:bg-accent"
                  >
                    {card.deadline
                      ? formatDeadline(card.deadline)
                      : t("Выбрать дату…")}
                  </DateInput>
                </td>
                <td className="p-2">
                  {card.boardLink ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`~/d/${card.boardLink!.boardId}`)}
                    >
                      {t("Открыть связанную доску")}
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
                {fieldDefs
                  .filter((f) => shown.includes(f.id))
                  .map((field) => (
                    <td key={field.id} className="max-w-64 p-2 break-words">
                      {card.fieldValues?.[field.id] === true
                        ? "✓"
                        : card.fieldValues?.[field.id] === false
                          ? "—"
                          : String(card.fieldValues?.[field.id] ?? "—")}
                    </td>
                  ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {!cards.length && (
        <p className="p-6 text-sm text-muted-foreground">
          {t("Подходящих карточек нет")}
        </p>
      )}
    </div>
  )
}
