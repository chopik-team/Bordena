import { useState, memo } from "react"
import { useT } from "@bordena/i18n"
import {
  GoalPathSchema,
  type GoalPath,
  type GoalMetric,
} from "@bordena/contract"
import {
  cardAxes,
  goalProgress,
  metricProgress,
  setGoalStep,
  type Board,
  type Dashboard,
  type CardPatch,
  type ProgressReader,
} from "@bordena/core"
import {
  Button,
  Modal,
  ModalContent,
  ModalTitle,
  DateInput,
  formatDeadline,
} from "@bordena/ui-kit"
import { applyOperations, type Operation } from "@/lib/exchange/changeset"
import { formatLocalError } from "@/lib/local-error"
import { Card } from "../card/card"
import { ProgressField } from "../progress-field"

const inputClass =
  "min-w-0 rounded border bg-background px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring"
const statuses = ["not-started", "in-progress", "completed", "paused"] as const
const statusLabels = {
  "not-started": "Не начат",
  "in-progress": "В работе",
  completed: "Завершён",
  paused: "На паузе",
}
function initialGoal(dashboard: Dashboard): GoalPath {
  return (
    dashboard.goalPath ?? {
      schemaVersion: 1,
      progressMode: "stages",
      steps: (dashboard.layout?.stages ?? []).map((s) => ({
        id: s.id,
        required: true,
        status: "not-started",
      })),
      metrics: [],
    }
  )
}
export function GoalPathView({
  dashboard,
  board,
  onPatch,
  onAdd,
  addDisabledReason,
  progressOf,
}: {
  dashboard: Dashboard
  board: Board
  onPatch: (id: string, patch: CardPatch) => void
  onAdd: (stageId: string, stateId: string) => void
  addDisabledReason?: string
  progressOf: ProgressReader
}) {
  const t = useT(),
    goal = dashboard.goalPath,
    [open, setOpen] = useState(false),
    [draft, setDraft] = useState(initialGoal(dashboard))
  const [stages, setStages] = useState(
    (dashboard.layout?.stages ?? []).map((s) => ({ id: s.id, title: s.title }))
  )
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deadline, setDeadline] = useState(dashboard.deadline ?? null)
  const [measurement, setMeasurement] = useState(""),
    [date, setDate] = useState<string | null>(
      new Date().toLocaleDateString("en-CA")
    ),
    [makeCurrent, setMakeCurrent] = useState(true)
  const [historyLimit, setHistoryLimit] = useState(100)
  const progress = goalProgress(goal),
    metric = goal?.metrics.find((m) => m.id === goal.metricId)
  const run = async (operations: Operation[]) => {
    setBusy(true)
    setError("")
    try {
      await applyOperations(operations)
    } catch (e) {
      setError(formatLocalError(e))
      throw e
    } finally {
      setBusy(false)
    }
  }
  const save = async (next: GoalPath) =>
    run([
      {
        op: "configure-goal-path",
        id: dashboard.id,
        expectedUpdatedAt: dashboard.updatedAt,
        goalPath: GoalPathSchema.parse(next),
      },
    ])
  const edit = () => {
    setDraft(initialGoal(dashboard))
    setStages(
      (dashboard.layout?.stages ?? []).map((s) => ({
        id: s.id,
        title: s.title,
      }))
    )
    setDeadline(dashboard.deadline ?? null)
    setError("")
    setOpen(true)
  }
  const patchMetric = (id: string, patch: Partial<GoalMetric>) =>
    setDraft((g) => ({
      ...g,
      metrics: g.metrics.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  const cardsFor = (stageId?: string) =>
    board.cards.filter((c) => {
      const id = dashboard.layout
        ? cardAxes(c, dashboard.layout).stageId
        : c.stageId
      return stageId ? id === stageId : !goal?.steps.some((s) => s.id === id)
    })
  const renderCards = (stageId?: string) => (
    <div className="space-y-2">
      {cardsFor(stageId).map((card) => {
        const column = board.columns.find((c) => c.id === card.columnId)
        return column ? (
          <Card
            key={card.id}
            card={card}
            layout={dashboard.layout}
            column={column}
            showBody={!column.collapsed}
            isDragging={false}
            onPatch={onPatch}
            presentationProgress={progressOf(card) ?? null}
          />
        ) : null
      })}
    </div>
  )
  return (
    <section
      className="min-w-0 flex-1 overflow-auto p-4"
      aria-label={t("Путь к цели")}
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold">{t("Путь к цели")}</h2>
            <p className="max-w-2xl text-sm whitespace-pre-wrap text-muted-foreground">
              {goal?.description ||
                t(
                  "Наметьте этапы, прикрепите задачи и двигайтесь к своему результату."
                )}
            </p>
            {goal && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <progress
                  className="h-2 w-48 appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
                  max="100"
                  value={progress ?? 0}
                  aria-label={t("Готовность цели")}
                />
                <span>
                  {progress === null
                    ? t("Готовность не определена")
                    : `${progress}%`}
                </span>
                {goal.progressMode === "manual" && (
                  <ProgressField
                    key={goal.manualProgress}
                    value={goal.manualProgress}
                    label={t("Готовность цели")}
                    onCommit={(manualProgress) =>
                      void save({ ...goal, manualProgress }).catch(() => {})
                    }
                  />
                )}
              </div>
            )}
            {goal && (
              <p className="text-xs text-muted-foreground">
                {t("Источник готовности")}:{" "}
                {goal.progressMode === "manual"
                  ? t("Ручная готовность")
                  : goal.progressMode === "stages"
                    ? t("Обязательные этапы")
                    : (metric?.title ?? t("Моя метрика"))}
              </p>
            )}
            {dashboard.deadline && (
              <p className="text-xs text-muted-foreground">
                {t("Срок проекта")}: {formatDeadline(dashboard.deadline)}
              </p>
            )}
          </div>
          <Button variant="secondary" onClick={edit} disabled={busy}>
            {t(goal ? "Настроить путь" : "Создать путь к цели")}
          </Button>
        </header>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {goal && (
          <>
            {metric && (
              <section
                className="space-y-3 rounded-xl border p-4"
                aria-label={t("Моя метрика")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{metric.title}</h3>
                  <span className="text-sm">
                    {metric.current ?? "—"} / {metric.target} {metric.unit} ·{" "}
                    {metricProgress(metric) ?? "—"}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Значения и цель задаёте вы. История измерений не является рекомендацией."
                  )}
                </p>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (measurement === "" || !date) return
                    void run([
                      {
                        op: "record-measurement",
                        id: dashboard.id,
                        expectedUpdatedAt: dashboard.updatedAt,
                        metricId: metric.id,
                        measurement: {
                          id: crypto.randomUUID(),
                          date,
                          value: Number(measurement),
                        },
                        makeCurrent,
                      },
                    ])
                      .then(() => setMeasurement(""))
                      .catch(() => {})
                  }}
                >
                  <label className="grid gap-1 text-xs">
                    {t("Значение")}
                    <input
                      className={inputClass + " w-28"}
                      required
                      type="number"
                      step="any"
                      value={measurement}
                      onChange={(e) => setMeasurement(e.target.value)}
                    />
                  </label>
                  <DateInput
                    withTime
                    value={date}
                    onChange={setDate}
                    className={inputClass}
                    inputProps={{ "aria-label": t("Дата измерения") }}
                  >
                    {date ? formatDeadline(date) : t("Выбрать дату…")}
                  </DateInput>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={makeCurrent}
                      onChange={(e) => setMakeCurrent(e.target.checked)}
                    />
                    {t("Сделать текущим значением")}
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy || measurement === "" || !date}
                  >
                    {t("Записать измерение")}
                  </Button>
                </form>
                {!!metric.history?.length && (
                  <details>
                    <summary className="cursor-pointer text-sm">
                      {t("История измерений")} ({metric.history.length})
                    </summary>
                    {metric.history.length >= 2 && (
                      <MetricChart metric={metric} />
                    )}
                    <div className="max-h-48 overflow-auto">
                      {metric.history
                        .slice(-historyLimit)
                        .reverse()
                        .map((h) => (
                          <div
                            key={h.id}
                            className="flex justify-between gap-4 py-1 text-xs"
                          >
                            <span>{formatDeadline(h.date)}</span>
                            <span>
                              {h.value} {metric.unit}
                            </span>
                          </div>
                        ))}
                    </div>
                    {metric.history.length > historyLimit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistoryLimit((n) => n + 100)}
                      >
                        {t("Показать ещё")}
                      </Button>
                    )}
                  </details>
                )}
              </section>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-start gap-4">
              {goal.steps.map((step, index) => (
                <section
                  key={step.id}
                  className="min-w-0 space-y-3 rounded-xl border bg-background p-3"
                  aria-label={
                    stages.find((s) => s.id === step.id)?.title ??
                    dashboard.layout?.stages.find((s) => s.id === step.id)
                      ?.title
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                      {index + 1}
                    </span>
                    <h3 className="min-w-0 flex-1 font-medium break-words">
                      {
                        dashboard.layout?.stages.find((s) => s.id === step.id)
                          ?.title
                      }
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select
                      aria-label={t("Состояние этапа")}
                      className={inputClass}
                      disabled={busy}
                      value={step.status}
                      onChange={(e) => {
                        try {
                          void save(
                            setGoalStep(
                              goal,
                              step.id,
                              e.target.value as typeof step.status
                            )
                          ).catch(() => {})
                        } catch (error) {
                          setError(formatLocalError(error))
                        }
                      }}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {t(statusLabels[s])}
                        </option>
                      ))}
                    </select>
                    <span className="text-muted-foreground">
                      {t(step.required ? "Обязательный" : "Необязательный")}
                    </span>
                    {!step.required && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void save({
                            ...goal,
                            steps: goal.steps.map((s) =>
                              s.id === step.id
                                ? { ...s, skipped: !s.skipped }
                                : s
                            ),
                          }).catch(() => {})
                        }
                      >
                        {t(step.skipped ? "Вернуть этап" : "Пропустить")}
                      </Button>
                    )}
                  </div>
                  {!step.skipped && (
                    <>
                      {renderCards(step.id)}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy || !!addDisabledReason}
                          tooltip={addDisabledReason}
                          onClick={() =>
                            onAdd(
                              step.id,
                              dashboard.layout?.states[0]?.id ?? ""
                            )
                          }
                        >
                          {t("Добавить карточку")}
                        </Button>
                        <select
                          aria-label={t("Прикрепить существующую карточку")}
                          className={inputClass + " max-w-full flex-1"}
                          value=""
                          disabled={!!addDisabledReason}
                          onChange={(e) => {
                            if (e.target.value)
                              onPatch(e.target.value, { stageId: step.id })
                          }}
                        >
                          <option value="">{t("Прикрепить карточку…")}</option>
                          {board.cards
                            .filter(
                              (c) =>
                                !cardsFor(step.id).some((x) => x.id === c.id)
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}
                </section>
              ))}
            </div>
            {!goal.steps.length && (
              <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                {t("Путь пока пуст. Добавьте первый этап в настройках пути.")}
              </p>
            )}
            {!!cardsFor().length && (
              <section className="max-w-md space-y-3">
                <h3 className="font-medium">{t("Вне этапов пути")}</h3>
                {renderCards()}
              </section>
            )}
          </>
        )}
      </div>
      <Modal open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <ModalContent className="max-h-[85vh] overflow-y-auto md:max-w-2xl">
          <ModalTitle>{t("Настроить путь")}</ModalTitle>
          <form
            className="mt-4 space-y-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault()
              setError("")
              try {
                const goalPath = GoalPathSchema.parse(draft)
                void run([
                  {
                    op: "configure-goal-path",
                    id: dashboard.id,
                    expectedUpdatedAt: dashboard.updatedAt,
                    goalPath,
                    stages: stages.filter((s) =>
                      draft.steps.some((x) => x.id === s.id)
                    ),
                  },
                  {
                    op: "update-board",
                    id: dashboard.id,
                    expectedUpdatedAt: dashboard.updatedAt,
                    patch: { deadline },
                  },
                ])
                  .then(() => setOpen(false))
                  .catch(() => {})
              } catch (error) {
                setError(formatLocalError(error))
              }
            }}
          >
            <label className="grid gap-1">
              {t("Описание цели")}
              <textarea
                className={inputClass}
                maxLength={10000}
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="grid gap-1">
                {t("Источник готовности")}
                <select
                  className={inputClass}
                  aria-label={t("Источник готовности")}
                  value={draft.progressMode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      progressMode: e.target.value as GoalPath["progressMode"],
                    })
                  }
                >
                  <option value="manual">{t("Ручная готовность")}</option>
                  <option value="stages">{t("Обязательные этапы")}</option>
                  <option value="metric">{t("Моя метрика")}</option>
                </select>
              </label>
              <DateInput
                withTime
                value={deadline}
                onChange={setDeadline}
                inputProps={{ "aria-label": t("Срок проекта") }}
                className={inputClass}
              >
                {deadline ? formatDeadline(deadline) : t("Срок проекта")}
              </DateInput>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.strictOrder ?? false}
                onChange={(e) =>
                  setDraft({ ...draft, strictOrder: e.target.checked })
                }
              />
              {t("Проходить обязательные этапы по порядку")}
            </label>
            <fieldset className="space-y-2">
              <legend className="mb-2 font-medium">{t("Этапы пути")}</legend>
              {draft.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex flex-wrap items-center gap-2 rounded border p-2"
                >
                  <input
                    required
                    className={inputClass + " flex-1"}
                    aria-label={t("Название этапа")}
                    maxLength={4096}
                    value={stages.find((s) => s.id === step.id)?.title ?? ""}
                    onChange={(e) =>
                      setStages(
                        stages.map((s) =>
                          s.id === step.id ? { ...s, title: e.target.value } : s
                        )
                      )
                    }
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={step.required}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          steps: draft.steps.map((s) =>
                            s.id === step.id
                              ? {
                                  ...s,
                                  required: e.target.checked,
                                  skipped: false,
                                }
                              : s
                          ),
                        })
                      }
                    />
                    {t("Обязательный")}
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t("Этап выше")}
                    disabled={index === 0}
                    onClick={() => {
                      const steps = [...draft.steps]
                      ;[steps[index - 1], steps[index]] = [
                        steps[index],
                        steps[index - 1],
                      ]
                      setDraft({ ...draft, steps })
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t("Этап ниже")}
                    disabled={index === draft.steps.length - 1}
                    onClick={() => {
                      const steps = [...draft.steps]
                      ;[steps[index + 1], steps[index]] = [
                        steps[index],
                        steps[index + 1],
                      ]
                      setDraft({ ...draft, steps })
                    }}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.filter((s) => s.id !== step.id),
                      })
                    }
                  >
                    {t("Убрать из пути")}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const id = crypto.randomUUID()
                  setStages([...stages, { id, title: t("Новый этап") }])
                  setDraft({
                    ...draft,
                    steps: [
                      ...draft.steps,
                      { id, required: true, status: "not-started" },
                    ],
                  })
                }}
              >
                {t("Добавить этап")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Удаление этапа из пути сохраняет его карточки и секции доски."
                )}
              </p>
            </fieldset>
            <fieldset className="space-y-3 rounded border p-3">
              <legend>{t("Мои метрики")}</legend>
              {draft.metrics.map((m) => (
                <div
                  key={m.id}
                  className="space-y-2 border-b pb-3 last:border-0"
                >
                  <div className="flex gap-2">
                    <input
                      className={inputClass + " flex-1"}
                      aria-label={t("Название метрики")}
                      required
                      maxLength={256}
                      value={m.title}
                      onChange={(e) =>
                        patchMetric(m.id, { title: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          metrics: draft.metrics.filter((x) => x.id !== m.id),
                          metricId:
                            draft.metricId === m.id
                              ? undefined
                              : draft.metricId,
                        })
                      }
                    >
                      {t("Удалить")}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["start", "Старт"],
                        ["target", "Цель"],
                        ["current", "Текущее значение"],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field} className="grid gap-1 text-xs">
                        {t(label)}
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          required={field !== "current"}
                          value={m[field] ?? ""}
                          onChange={(e) =>
                            patchMetric(m.id, {
                              [field]:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    ))}
                    <label className="grid gap-1 text-xs">
                      {t("Единица")}
                      <input
                        className={inputClass}
                        maxLength={64}
                        value={m.unit}
                        onChange={(e) =>
                          patchMetric(m.id, { unit: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <select
                    aria-label={t("Направление метрики")}
                    className={inputClass}
                    value={m.direction}
                    onChange={(e) =>
                      patchMetric(m.id, {
                        direction: e.target.value as GoalMetric["direction"],
                      })
                    }
                  >
                    <option value="increase">{t("Увеличение")}</option>
                    <option value="decrease">{t("Уменьшение")}</option>
                  </select>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const id = crypto.randomUUID()
                  setDraft({
                    ...draft,
                    metricId: draft.metricId ?? id,
                    metrics: [
                      ...draft.metrics,
                      {
                        id,
                        title: t("Моя метрика"),
                        start: 0,
                        target: 100,
                        unit: "",
                        direction: "increase",
                      },
                    ],
                  })
                }}
              >
                {t("Добавить метрику")}
              </Button>
              {!!draft.metrics.length && (
                <label className="flex flex-wrap items-center gap-2">
                  {t("Метрика готовности")}
                  <select
                    className={inputClass}
                    value={draft.metricId ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        metricId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">{t("Не выбрана")}</option>
                    {draft.metrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t("Отмена")}
              </Button>
              <Button type="submit" disabled={busy}>
                {t("Сохранить")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </section>
  )
}
const MetricChart = memo(function MetricChart({
  metric,
}: {
  metric: GoalMetric
}) {
  const t = useT(),
    values = metric.history ?? [],
    times = values.map((v) =>
      new Date(v.date.length === 10 ? `${v.date}T12:00:00` : v.date).getTime()
    ),
    first = Math.min(...times),
    last = Math.max(...times),
    min = Math.min(...values.map((v) => v.value)),
    max = Math.max(...values.map((v) => v.value)),
    valueScale = Math.max(1, Math.abs(min), Math.abs(max))
  const points = values
    .map(
      (v, i) =>
        `${12 + (last === first ? i / (values.length - 1) : (times[i] - first) / (last - first)) * 276},${84 - (max === min ? 0.5 : (v.value / valueScale - min / valueScale) / (max / valueScale - min / valueScale)) * 64}`
    )
    .join(" ")
  return (
    <svg
      className="my-2 h-28 w-full text-primary"
      viewBox="0 0 300 100"
      role="img"
      aria-label={t("Динамика моих измерений")}
    >
      <title>{t("Динамика моих измерений")}</title>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
      {points.split(" ").map((p, i) =>
        i % Math.max(1, Math.ceil(values.length / 200)) === 0 ||
        i === values.length - 1 ? (
          <circle
            key={values[i].id}
            cx={p.split(",")[0]}
            cy={p.split(",")[1]}
            r="3"
            fill="currentColor"
          >
            <title>{`${formatDeadline(values[i].date)}: ${values[i].value} ${metric.unit}`}</title>
          </circle>
        ) : null
      )}
    </svg>
  )
})
