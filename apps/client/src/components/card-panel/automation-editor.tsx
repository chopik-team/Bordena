import { useState } from "react"
import { useT } from "@bordena/i18n"
import { useCard, useCardCol, useDashboards, useBoard } from "@bordena/core"
import { AutomationRuleSchema, type AutomationRule } from "@bordena/contract"
import { Button } from "@bordena/ui-kit"
import { applyOperations, type Operation } from "@/lib/exchange/changeset"
import { formatLocalError } from "@/lib/local-error"

const conditions = {
  deadline: "Срок истёк",
  "checklist-complete": "Все пункты чек-листа выполнены",
  "progress-complete": "Готовность карточки — 100%",
  "goal-complete": "Обязательные этапы цели завершены",
  "metric-target": "Цель метрики достигнута",
  "linked-range": "Готовность связанной доски в диапазоне",
}
const actions = {
  "move-section": "Переместить в секцию",
  "set-stage": "Назначить этап",
  "set-state": "Назначить состояние",
  "set-progress": "Задать ручную готовность",
  "complete-goal-step": "Завершить этап цели",
  history: "Только запись в истории",
}
const results: Record<string, string> = {
  applied: "Выполнено",
  "no-op": "Уже выполнено",
  conflict: "Конфликт правил",
  "missing-target": "Цель действия недоступна",
  "skipped-complete": "Пропущено: задача завершена",
  "skipped-archived": "Пропущено: архив",
  undone: "Отменено через историю",
  armed: "Ожидание условия",
}
const inputClass =
  "min-w-0 rounded border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
export function AutomationEditor({ cardId }: { cardId: string }) {
  const t = useT(),
    { data: card } = useCard(cardId),
    { data: column } = useCardCol(cardId),
    { data: boards = [] } = useDashboards()
  const board = boards.find((b) => b.id === column?.dashboardId),
    { data: data } = useBoard(board?.id ?? "")
  const [draft, setDraft] = useState<AutomationRule | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  if (!card || !board) return null
  const run = async (op: Operation) => {
    setBusy(true)
    setError("")
    try {
      await applyOperations([op])
      setDraft(null)
    } catch (e) {
      setError(formatLocalError(e))
    } finally {
      setBusy(false)
    }
  }
  const revision = { id: card.id, expectedUpdatedAt: card.updatedAt }
  const create = (deadline = false) => {
    const old = deadline
      ? card.automationRules?.find((r) => r.id === "deadline-action")
      : undefined
    setError("")
    setDraft(
      old
        ? structuredClone(old)
        : {
            id: deadline ? "deadline-action" : crypto.randomUUID(),
            title: t(deadline ? "Действие по сроку" : "Новое правило"),
            revision: 1,
            enabled: true,
            paused: false,
            condition: { type: deadline ? "deadline" : "checklist-complete" },
            action: { type: "history", message: t("Условие выполнено") },
          }
    )
  }
  const changeCondition = (type: AutomationRule["condition"]["type"]) => {
    if (!draft) return
    setDraft({
      ...draft,
      condition:
        type === "metric-target"
          ? { type, metricId: board.goalPath?.metrics[0]?.id ?? "" }
          : type === "linked-range"
            ? { type, min: 0, max: 100 }
            : { type },
    })
  }
  const changeAction = (type: AutomationRule["action"]["type"]) => {
    if (!draft) return
    const action: AutomationRule["action"] =
      type === "move-section"
        ? { type, columnId: data?.columns[0]?.id ?? "" }
        : type === "set-stage"
          ? { type, stageId: board.layout?.stages[0]?.id ?? "" }
          : type === "set-state"
            ? { type, stateId: board.layout?.states[0]?.id ?? "" }
            : type === "complete-goal-step"
              ? { type, stepId: board.goalPath?.steps[0]?.id ?? "" }
              : type === "set-progress"
                ? { type, value: 100 }
                : { type, message: t("Условие выполнено") }
    setDraft({ ...draft, action })
  }
  const targets =
    draft?.action.type === "move-section"
      ? data?.columns
      : draft?.action.type === "set-stage"
        ? board.layout?.stages
        : draft?.action.type === "set-state"
          ? board.layout?.states
          : draft?.action.type === "complete-goal-step"
            ? board.layout?.stages.filter((s) =>
                board.goalPath?.steps.some((x) => x.id === s.id)
              )
            : []
  const targetField =
    draft?.action.type === "move-section"
      ? "columnId"
      : draft?.action.type === "set-stage"
        ? "stageId"
        : draft?.action.type === "set-state"
          ? "stateId"
          : draft?.action.type === "complete-goal-step"
            ? "stepId"
            : null
  const deadlineRule = card.automationRules?.find(
    (r) => r.id === "deadline-action"
  )
  return (
    <details className="border-b px-4 py-2 text-sm">
      <summary className="cursor-pointer py-1 font-medium">
        {t("Автоматизация")}{" "}
        {card.automationRules?.length ? `(${card.automationRules.length})` : ""}
      </summary>
      <div className="space-y-3 py-2">
        <p className="text-xs text-muted-foreground">
          {t(
            "По умолчанию срок только подсвечивается. Действия выполняются локально после сохранения, когда Bordena открыта, и при следующем запуске."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => create(true)}
          >
            {t("Действие по сроку")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => create()}
          >
            {t("Добавить правило")}
          </Button>
          {deadlineRule && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run({
                  op: "set-deadline-action",
                  ...revision,
                  action: null,
                  includeCompleted: false,
                  includeArchived: false,
                })
              }
            >
              {t("Срок: только подсветка")}
            </Button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={card.archived ?? false}
            disabled={busy}
            onChange={(e) =>
              void run({
                op: "update-card",
                ...revision,
                patch: { archived: e.target.checked },
              })
            }
          />
          {t("Архивная карточка — пропускать автоматизацию")}
        </label>
        {card.automationRules?.map((rule) => {
          const state = card.automationState?.find((s) => s.ruleId === rule.id)
          return (
            <article key={rule.id} className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="min-w-0 flex-1 font-medium break-words">
                  {rule.title}
                </strong>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setDraft(structuredClone(rule))}
                >
                  {t("Изменить")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      op: "remove-rule",
                      ...revision,
                      ruleId: rule.id,
                    })
                  }
                >
                  {t("Удалить")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(conditions[rule.condition.type])} →{" "}
                {t(actions[rule.action.type])}
              </p>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    disabled={busy}
                    onChange={(e) =>
                      void run({
                        op: "set-rule-enabled",
                        ...revision,
                        ruleId: rule.id,
                        enabled: e.target.checked,
                      })
                    }
                  />
                  {t("Включено")}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={rule.paused}
                    disabled={busy}
                    onChange={(e) =>
                      void run({
                        op: "set-rule-enabled",
                        ...revision,
                        ruleId: rule.id,
                        enabled: rule.enabled,
                        paused: e.target.checked,
                      })
                    }
                  />
                  {t("Пауза")}
                </label>
              </div>
              {state && (
                <p className="text-xs text-muted-foreground">
                  {t(results[state.result])} ·{" "}
                  {new Date(state.at).toLocaleString()}
                  <br />
                  {t(state.reason)}
                </p>
              )}
            </article>
          )
        })}
        {draft && (
          <form
            className="space-y-3 rounded border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              try {
                const old = card.automationRules?.find((r) => r.id === draft.id)
                const rule = AutomationRuleSchema.parse({
                  ...draft,
                  revision: old ? old.revision + 1 : 1,
                })
                void run({ op: "upsert-rule", ...revision, rule })
              } catch (error) {
                setError(formatLocalError(error))
              }
            }}
          >
            <label className="grid gap-1">
              {t("Название правила")}
              <input
                className={inputClass}
                required
                maxLength={256}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="grid gap-1">
              {t("Если")}
              <select
                className={inputClass}
                aria-label={t("Если")}
                value={draft.condition.type}
                onChange={(e) =>
                  changeCondition(
                    e.target.value as AutomationRule["condition"]["type"]
                  )
                }
              >
                {Object.entries(conditions).map(([type, label]) => (
                  <option
                    key={type}
                    value={type}
                    disabled={
                      (type === "metric-target" &&
                        !board.goalPath?.metrics.length) ||
                      (type === "goal-complete" && !board.goalPath) ||
                      (type === "linked-range" && !card.boardLink)
                    }
                  >
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            {draft.condition.type === "metric-target" && (
              <select
                aria-label={t("Моя метрика")}
                className={inputClass}
                value={draft.condition.metricId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    condition: {
                      type: "metric-target",
                      metricId: e.target.value,
                    },
                  })
                }
              >
                {board.goalPath?.metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )}
            {draft.condition.type === "linked-range" && (
              <div className="flex gap-2">
                {(["min", "max"] as const).map((field) => (
                  <label key={field} className="grid gap-1 text-xs">
                    {t(field === "min" ? "От, %" : "До, %")}
                    <input
                      className={inputClass + " w-24"}
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={
                        draft.condition.type === "linked-range"
                          ? draft.condition[field]
                          : 0
                      }
                      onChange={(e) => {
                        if (draft.condition.type === "linked-range")
                          setDraft({
                            ...draft,
                            condition: {
                              ...draft.condition,
                              [field]: Number(e.target.value),
                            },
                          })
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
            <label className="grid gap-1">
              {t("Тогда")}
              <select
                className={inputClass}
                aria-label={t("Тогда")}
                value={draft.action.type}
                onChange={(e) =>
                  changeAction(
                    e.target.value as AutomationRule["action"]["type"]
                  )
                }
              >
                {Object.entries(actions).map(([type, label]) => (
                  <option
                    key={type}
                    value={type}
                    disabled={
                      (type === "complete-goal-step" &&
                        !board.goalPath?.steps.length) ||
                      (type === "set-stage" && !board.layout) ||
                      (type === "set-state" && !board.layout) ||
                      (type === "move-section" && !data?.columns.length)
                    }
                  >
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            {targetField && (
              <label className="grid gap-1">
                {t("Цель действия")}
                <select
                  className={inputClass}
                  required
                  value={
                    (draft.action as unknown as Record<string, string>)[
                      targetField
                    ]
                  }
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      action: {
                        ...draft.action,
                        [targetField]: e.target.value,
                      } as AutomationRule["action"],
                    })
                  }
                >
                  <option value="" disabled>
                    {t("Не выбрана")}
                  </option>
                  {targets?.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {draft.action.type === "set-progress" && (
              <label className="grid gap-1">
                {t("Готовность, %")}
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  className={inputClass}
                  value={draft.action.value}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      action: {
                        type: "set-progress",
                        value: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            )}
            {draft.action.type === "history" && (
              <label className="grid gap-1">
                {t("Запись в истории")}
                <input
                  maxLength={1000}
                  className={inputClass}
                  value={draft.action.message}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      action: { type: "history", message: e.target.value },
                    })
                  }
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={draft.includeCompleted ?? false}
                onChange={(e) =>
                  setDraft({ ...draft, includeCompleted: e.target.checked })
                }
              />
              {t("Разрешить для завершённых задач")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={draft.includeArchived ?? false}
                onChange={(e) =>
                  setDraft({ ...draft, includeArchived: e.target.checked })
                }
              />
              {t("Разрешить в архиве")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t(
                "Сохранение включает правило. Уже выполненное условие проверится сразу. Изменение правила создаёт новое событие."
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                {t("Отмена")}
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {t("Сохранить правило")}
              </Button>
            </div>
          </form>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  )
}
