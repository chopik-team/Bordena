import { formatLocalError } from "@/lib/local-error"
import { useState } from "react"
import { useLocation } from "wouter"
import { useT } from "@bordena/i18n"
import {
  useCard,
  useCardCol,
  useDashboards,
  useBoard,
  type BoardLink,
} from "@bordena/core"
import { Button } from "@bordena/ui-kit"
import { setCardBoardLink } from "@/lib/exchange/changeset"

export function BoardLinkEditor({ cardId }: { cardId: string }) {
  const t = useT(),
    [, navigate] = useLocation()
  const { data: card } = useCard(cardId),
    { data: column } = useCardCol(cardId),
    { data: boards = [] } = useDashboards()
  const parent = boards.find((b) => b.id === column?.dashboardId)
  const { data: parentData } = useBoard(parent?.id ?? "")
  const [draft, setDraft] = useState<BoardLink | null>(card?.boardLink ?? null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const persisted = JSON.stringify(card?.boardLink ?? null),
    [previous, setPrevious] = useState(persisted)
  if (previous !== persisted) {
    setPrevious(persisted)
    setDraft(card?.boardLink ?? null)
  }
  const { data: child } = useBoard(draft?.boardId ?? "")
  const target = boards.find((b) => b.id === card?.boardLink?.boardId)
  const setSource = (patch: Partial<BoardLink["source"]>) =>
    setDraft((d) => (d ? { ...d, source: { ...d.source, ...patch } } : d))
  const toggle = (
    field:
      "cardIds" | "sectionIds" | "completedColumnIds" | "completedStateIds",
    id: string
  ) => {
    if (!draft) return
    const current = draft.source[field] ?? []
    setSource({
      [field]: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    })
  }
  if (!card) return null
  return (
    <details className="border-b px-4 py-2 text-sm">
      <summary className="cursor-pointer py-1 font-medium">
        {t("Связанная доска")}
        {card.boardLink ? `: ${target?.title ?? t("Доска недоступна")}` : ""}
      </summary>
      {card.boardLink && (
        <div className="flex flex-wrap items-center gap-2 py-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!target}
            onClick={() => navigate(`~/d/${card.boardLink!.boardId}`)}
          >
            {t("Открыть связанную доску")}
          </Button>
          {card.boardLink.mode !== "navigation" && (
            <span>
              {card.linkedProgress?.value == null
                ? t("Готовность не определена")
                : `${card.linkedProgress.value}%`}{" "}
              {card.linkedProgress?.reason === "missing"
                ? t("Доска недоступна")
                : card.linkedProgress?.reason === "empty"
                  ? t("Нет задач")
                  : card.linkedProgress?.reason === "unset"
                    ? t("Источник готовности не задан")
                    : ""}
            </span>
          )}
        </div>
      )}
      <div className="space-y-3 py-2">
        <label className="block">
          {t("Доска")}
          <select
            aria-label={t("Дочерняя доска")}
            className="mt-1 w-full rounded border bg-background p-2"
            value={draft?.boardId ?? ""}
            onChange={(e) =>
              setDraft(
                e.target.value
                  ? {
                      schemaVersion: 1,
                      boardId: e.target.value,
                      mode: "navigation",
                      source: { type: "tasks" },
                      requireFullCoverage: true,
                      rules: [],
                    }
                  : null
              )
            }
          >
            <option value="">{t("Без связи")}</option>
            {boards
              .filter((b) => b.id !== parent?.id)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
          </select>
        </label>
        {draft && (
          <>
            <label className="block">
              {t("Режим связи")}
              <select
                className="mt-1 w-full rounded border bg-background p-2"
                aria-label={t("Режим связи")}
                value={draft.mode}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    mode: e.target.value as BoardLink["mode"],
                  })
                }
              >
                <option value="navigation">{t("Только переход")}</option>
                <option value="progress">{t("Переход и готовность")}</option>
                <option value="auto-move">
                  {t("Готовность и автоперенос")}
                </option>
              </select>
            </label>
            {draft.mode !== "navigation" && (
              <>
                <label className="block">
                  {t("Источник готовности")}
                  <select
                    className="mt-1 w-full rounded border bg-background p-2"
                    value={draft.source.type}
                    onChange={(e) =>
                      setSource({
                        type: e.target.value as BoardLink["source"]["type"],
                      })
                    }
                  >
                    <option value="goal">{t("Готовность пути к цели")}</option>
                    <option value="manual">
                      {t("Ручная готовность доски")}
                    </option>
                    <option value="tasks">{t("Завершённые задачи")}</option>
                    <option value="stages">{t("Готовность этапов")}</option>
                    <option value="selected">
                      {t("Выбранные карточки или секции")}
                    </option>
                  </select>
                </label>
                {draft.source.type === "tasks" && (
                  <fieldset className="space-y-1">
                    <legend>{t("Выполненные секции и состояния")}</legend>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "Без выбора используются секции с отметкой выполнения."
                      )}
                    </p>
                    {child?.columns.map((c) => (
                      <label key={c.id} className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={
                            draft.source.completedColumnIds?.includes(c.id) ??
                            false
                          }
                          onChange={() => toggle("completedColumnIds", c.id)}
                        />
                        {c.title}
                      </label>
                    ))}
                    {boards
                      .find((b) => b.id === draft.boardId)
                      ?.layout?.states.map((s) => (
                        <label key={s.id} className="flex gap-2">
                          <input
                            type="checkbox"
                            checked={
                              draft.source.completedStateIds?.includes(s.id) ??
                              false
                            }
                            onChange={() => toggle("completedStateIds", s.id)}
                          />
                          {s.title}
                        </label>
                      ))}
                  </fieldset>
                )}
                {draft.source.type === "stages" &&
                  boards
                    .find((b) => b.id === draft.boardId)
                    ?.layout?.stages.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center justify-between gap-2"
                      >
                        {s.title}
                        <input
                          className="w-24 rounded border bg-background p-2"
                          type="number"
                          min="0"
                          max="100"
                          aria-label={`${s.title} %`}
                          value={
                            draft.source.stageValues?.find((v) => v.id === s.id)
                              ?.value ?? ""
                          }
                          onChange={(e) =>
                            setSource({
                              stageValues: [
                                ...(draft.source.stageValues ?? []).filter(
                                  (v) => v.id !== s.id
                                ),
                                ...(e.target.value === ""
                                  ? []
                                  : [
                                      {
                                        id: s.id,
                                        value: Number(e.target.value),
                                      },
                                    ]),
                              ],
                            })
                          }
                        />
                      </label>
                    ))}
                {draft.source.type === "selected" && (
                  <fieldset>
                    <legend>{t("Выбор источников")}</legend>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "Без выбора учитываются все карточки; используются их ручные или связанные проценты."
                      )}
                    </p>
                    {child?.columns.map((c) => (
                      <label key={c.id} className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={
                            draft.source.sectionIds?.includes(c.id) ?? false
                          }
                          onChange={() => toggle("sectionIds", c.id)}
                        />
                        {c.title}
                      </label>
                    ))}
                    {child?.cards.map((c) => (
                      <label key={c.id} className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={
                            draft.source.cardIds?.includes(c.id) ?? false
                          }
                          onChange={() => toggle("cardIds", c.id)}
                        />
                        {c.title}
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}
            {draft.mode === "auto-move" && (
              <fieldset className="space-y-2">
                <legend>{t("Диапазоны автопереноса")}</legend>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Границы включены. Состояние карточки не меняется. Секция переносится только при явном выборе."
                  )}
                </p>
                {draft.rules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap gap-2 rounded border p-2"
                  >
                    {(["min", "max"] as const).map((field) => (
                      <input
                        key={field}
                        className="w-20 rounded border bg-background p-2"
                        aria-label={`${t(field === "min" ? "От" : "До")} ${index + 1}`}
                        type="number"
                        min="0"
                        max="100"
                        value={rule[field]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            rules: draft.rules.map((r, i) =>
                              i === index
                                ? { ...r, [field]: Number(e.target.value) }
                                : r
                            ),
                          })
                        }
                      />
                    ))}
                    <select
                      aria-label={t("Целевой этап")}
                      className="max-w-full min-w-0 rounded border bg-background p-2"
                      value={rule.stageId}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((r, i) =>
                            i === index ? { ...r, stageId: e.target.value } : r
                          ),
                        })
                      }
                    >
                      {parent?.layout?.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t("Целевая секция")}
                      className="max-w-full min-w-0 rounded border bg-background p-2"
                      value={rule.columnId ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((r, i) =>
                            i === index
                              ? { ...r, columnId: e.target.value || undefined }
                              : r
                          ),
                        })
                      }
                    >
                      <option value="">{t("Секцию не менять")}</option>
                      {parentData?.columns.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.title}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.filter((_, i) => i !== index),
                        })
                      }
                    >
                      {t("Убрать")}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      rules: [
                        ...draft.rules,
                        {
                          min: draft.rules.length
                            ? Math.min(100, draft.rules.at(-1)!.max + 1)
                            : 0,
                          max: 100,
                          stageId: parent?.layout?.stages[0].id ?? "",
                        },
                      ],
                    })
                  }
                >
                  {t("Добавить диапазон")}
                </Button>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={draft.requireFullCoverage}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        requireFullCoverage: e.target.checked,
                      })
                    }
                  />
                  {t("Полное покрытие 0–100")}
                </label>
              </fieldset>
            )}
          </>
        )}
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError("")
            void setCardBoardLink(card, draft)
              .catch((e) => setError(formatLocalError(e)))
              .finally(() => setBusy(false))
          }}
        >
          {t("Сохранить связь")}
        </Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  )
}
