import { useT, useLocale } from "@bordena/i18n"
import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import {
  useCreateDashboard,
  reportError,
  queryClient,
  keys,
  setBoardView,
} from "@bordena/core"
import {
  Button,
  Modal,
  ModalContent,
  ModalTitle,
  DateInput,
  formatDeadline,
} from "@bordena/ui-kit"
import { ensureLayout, changeLayout } from "@/lib/layout-workspace"
import { usePreferences } from "@/lib/preferences"
import { moveBoardGroup } from "@/lib/workspaces"
import { useOrganization } from "@/lib/hooks/use-organization"
import {
  builtinTemplates,
  applyOperations,
  type Operation,
} from "@/lib/exchange/changeset"
export function CreateBoardDialog() {
  const t = useT()
  const locale = useLocale()
  const preferences = usePreferences()
  const { data: organization } = useOrganization()
  const [description, setDescription] = useState(""),
    [stepNames, setStepNames] = useState(""),
    [deadline, setDeadline] = useState<string | null>(null),
    [progressMode, setProgressMode] = useState<"manual" | "stages" | "metric">(
      "stages"
    )
  const [metricTitle, setMetricTitle] = useState(""),
    [metricStart, setMetricStart] = useState(0),
    [metricTarget, setMetricTarget] = useState(100),
    [metricUnit, setMetricUnit] = useState("")
  const [automation, setAutomation] = useState(false)
  const [folderId, setFolderId] = useState("")
  const [templateId, setTemplateId] = useState(""),
    [templateCategory, setTemplateCategory] = useState(""),
    [examples, setExamples] = useState(false)
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(t("Новая доска")),
    [mode, setMode] = useState<"free" | "matrix" | "goal">("free"),
    [busy, setBusy] = useState(false)
  const { mutateAsync: create } = useCreateDashboard()
  const [, navigate] = useLocation()
  const templates = [
    ...builtinTemplates,
    ...(organization?.sidebar.templates ?? []),
  ]
  const categoryKey = (category: string) => `category:${category}`
  const categories = [
    ...new Set(templates.map((template) => template.category)),
  ].sort((a, b) =>
    t(a || "Без категории").localeCompare(t(b || "Без категории"), locale)
  )
  const categoryTemplates = templates
    .filter((template) => categoryKey(template.category) === templateCategory)
    .sort((a, b) =>
      (a.id.startsWith("builtin-") ? t(a.title) : a.title).localeCompare(
        b.id.startsWith("builtin-") ? t(b.title) : b.title,
        locale
      )
    )
  const selectedTemplate = templates.find(
    (template) => template.id === templateId
  )
  const selectTemplate = (id: string) => {
    setTemplateId(id)
    setExamples(false)
    setAutomation(false)
    const template = templates.find((template) => template.id === id)
    setMode(
      template
        ? template.goalPath
          ? "goal"
          : template.mode
        : preferences.defaultMode
    )
  }
  useEffect(() => {
    const show = () => {
      setTitle(t("Новая доска"))
      setMode(preferences.defaultMode)
      setFolderId("")
      setTemplateId("")
      setTemplateCategory("")
      setExamples(false)
      setAutomation(false)
      setDescription("")
      setStepNames("")
      setDeadline(null)
      setProgressMode("stages")
      setMetricTitle("")
      setOpen(true)
    }
    window.addEventListener("bordena:create-board", show)
    return () => window.removeEventListener("bordena:create-board", show)
  }, [preferences.defaultMode, t])
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!busy) setOpen(v)
      }}
    >
      <ModalContent className="max-h-[90svh] min-w-0 overflow-y-auto p-5 sm:p-6 md:max-w-xl [&_select]:max-w-full [&_select]:min-w-0 [&_select]:truncate">
        <ModalTitle>{t("Новая доска")}</ModalTitle>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            void (async () => {
              if (templateId || mode === "goal") {
                const boardId = crypto.randomUUID()
                const template = [
                  ...builtinTemplates,
                  ...(organization?.sidebar.templates ?? []),
                ].find((t) => t.id === templateId)
                const ops: Operation[] = [
                  {
                    op: "create-board",
                    id: boardId,
                    title: title.trim() || t("Новая доска"),
                    workspaceId: preferences.workspaceId,
                    projectId: folderId || undefined,
                    mode: mode === "matrix" ? "matrix" : "free",
                  },
                ]
                if (templateId)
                  ops.push({
                    op: "apply-template",
                    boardId,
                    templateId,
                    includeExamples: examples,
                    includeAutomation: examples && automation,
                  })
                else {
                  const stages = stepNames
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((title) => ({ id: crypto.randomUUID(), title }))
                  const metricId = crypto.randomUUID()
                  ops.push({
                    op: "configure-goal-path",
                    id: boardId,
                    expectedUpdatedAt: 0,
                    stages,
                    goalPath: {
                      schemaVersion: 1,
                      description,
                      progressMode,
                      steps: stages.map((s) => ({
                        id: s.id,
                        status: "not-started",
                        required: true,
                      })),
                      metrics: metricTitle.trim()
                        ? [
                            {
                              id: metricId,
                              title: metricTitle.trim(),
                              start: metricStart,
                              target: metricTarget,
                              unit: metricUnit,
                              direction:
                                metricTarget >= metricStart
                                  ? "increase"
                                  : "decrease",
                            },
                          ]
                        : [],
                      metricId: metricTitle.trim() ? metricId : undefined,
                    },
                  })
                  if (deadline)
                    ops.push({
                      op: "update-board",
                      id: boardId,
                      expectedUpdatedAt: 0,
                      patch: { deadline },
                    })
                }
                await applyOperations(ops)
                if (mode === "goal" || template?.goalPath)
                  setBoardView(boardId, "goal")
                setOpen(false)
                navigate(`~/d/${boardId}`)
                return
              }
              const board = await create(title.trim() || t("Новая доска"))
              // A failure leaves the created ordinary board intact and accessible.
              try {
                await moveBoardGroup(
                  board.id,
                  preferences.workspaceId,
                  folderId || undefined
                )
                await ensureLayout(board.id, mode)
                await changeLayout(board.id, (layout) => ({
                  ...layout,
                  lanes: layout.lanes.map((lane, index) => ({
                    ...lane,
                    title: `${t("Столбец")} ${index + 1}`,
                  })),
                }))
              } finally {
                await queryClient.invalidateQueries({
                  queryKey: keys.dashboards,
                })
                setOpen(false)
                navigate(`~/d/${board.id}`)
              }
            })()
              .catch(reportError)
              .finally(() => setBusy(false))
          }}
        >
          <label className="block text-sm">
            {t("Название")}{" "}
            <input
              autoFocus
              maxLength={4096}
              className="mt-1 w-full rounded-md border bg-background p-2 focus-visible:outline-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("Категория шаблона")}
            <select
              aria-label={t("Категория шаблона")}
              className="mt-1 w-full rounded-md border bg-background p-2"
              value={templateCategory}
              onChange={(e) => {
                const category = e.target.value
                setTemplateCategory(category)
                const first = templates
                  .filter(
                    (template) => categoryKey(template.category) === category
                  )
                  .sort((a, b) =>
                    (a.id.startsWith("builtin-")
                      ? t(a.title)
                      : a.title
                    ).localeCompare(
                      b.id.startsWith("builtin-") ? t(b.title) : b.title,
                      locale
                    )
                  )[0]
                selectTemplate(first?.id ?? "")
              }}
            >
              <option value="">{t("Без шаблона")}</option>
              {categories.map((category) => (
                <option key={category} value={categoryKey(category)}>
                  {t(category || "Без категории")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t("Шаблон")}
            <select
              aria-label={t("Шаблон")}
              className="mt-1 w-full rounded-md border bg-background p-2"
              value={templateId}
              disabled={!templateCategory}
              onChange={(e) => selectTemplate(e.target.value)}
            >
              {!templateCategory && (
                <option value="">{t("Стандартная доска")}</option>
              )}
              {categoryTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.id.startsWith("builtin-")
                    ? t(template.title)
                    : template.title}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate && (
            <div
              className="rounded-md bg-muted/50 p-3 text-sm"
              data-template-preview
            >
              <p className="mb-1 font-medium">
                {t(
                  selectedTemplate.goalPath ? "Этапы шаблона" : "Секции шаблона"
                )}
              </p>
              <p className="[overflow-wrap:anywhere] break-words text-muted-foreground">
                {(selectedTemplate.goalPath && selectedTemplate.layout
                  ? selectedTemplate.layout.stages
                  : selectedTemplate.sections
                )
                  .map((section) =>
                    selectedTemplate.id.startsWith("builtin-")
                      ? t(section.title)
                      : section.title
                  )
                  .join(" → ")}
              </p>
            </div>
          )}
          {templateId && (
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={examples}
                onChange={(e) => setExamples(e.target.checked)}
              />
              {t("Добавить примеры задач")}
            </label>
          )}
          {templateId && examples && (
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={automation}
                onChange={(e) => setAutomation(e.target.checked)}
              />
              {t("Включить правила из шаблона")}
            </label>
          )}
          <label className="block text-sm">
            {t("Компоновка")}{" "}
            <select
              className="mt-1 w-full rounded-md border bg-background p-2"
              aria-label={t("Компоновка")}
              value={mode}
              disabled={!!templateId}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="free">{t("Свободная — секции в столбцах")}</option>
              <option value="goal">{t("Путь к цели")}</option>
              <option value="matrix">{t("Матрица — этапы и состояния")}</option>
            </select>
          </label>
          {mode === "goal" && !templateId && (
            <fieldset className="space-y-3 rounded border p-3 text-sm">
              <label className="grid gap-1">
                {t("Описание цели")}
                <textarea
                  className="rounded border bg-background p-2"
                  maxLength={10000}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                {t("Этапы — по одному на строку")}
                <textarea
                  className="rounded border bg-background p-2"
                  rows={3}
                  value={stepNames}
                  maxLength={10000}
                  onChange={(e) => setStepNames(e.target.value)}
                  placeholder={t("Старт → промежуточные шаги → результат")}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {t("Оставьте этапы пустыми, чтобы начать с чистого пути.")}
              </p>
              <DateInput
                withTime
                value={deadline}
                onChange={setDeadline}
                className="rounded border p-2"
                inputProps={{ "aria-label": t("Срок проекта") }}
              >
                {deadline ? formatDeadline(deadline) : t("Срок проекта")}
              </DateInput>
              <label className="grid gap-1">
                {t("Источник готовности")}
                <select
                  className="rounded border bg-background p-2"
                  aria-label={t("Источник готовности")}
                  value={progressMode}
                  onChange={(e) =>
                    setProgressMode(e.target.value as typeof progressMode)
                  }
                >
                  <option value="stages">{t("Обязательные этапы")}</option>
                  <option value="manual">{t("Ручная готовность")}</option>
                  <option value="metric">{t("Моя метрика")}</option>
                </select>
              </label>
              {progressMode === "metric" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2 grid gap-1">
                    {t("Название метрики")}
                    <input
                      required
                      className="rounded border bg-background p-2"
                      value={metricTitle}
                      maxLength={256}
                      onChange={(e) => setMetricTitle(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1">
                    {t("Старт")}
                    <input
                      type="number"
                      step="any"
                      required
                      className="min-w-0 rounded border bg-background p-2"
                      value={metricStart}
                      onChange={(e) => setMetricStart(Number(e.target.value))}
                    />
                  </label>
                  <label className="grid gap-1">
                    {t("Цель")}
                    <input
                      type="number"
                      step="any"
                      required
                      className="min-w-0 rounded border bg-background p-2"
                      value={metricTarget}
                      onChange={(e) => setMetricTarget(Number(e.target.value))}
                    />
                  </label>
                  <label className="col-span-2 grid gap-1">
                    {t("Единица")}
                    <input
                      className="rounded border bg-background p-2"
                      maxLength={64}
                      value={metricUnit}
                      onChange={(e) => setMetricUnit(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </fieldset>
          )}
          <label className="block text-sm">
            {t("Проект или папка")}
            <select
              aria-label={t("Проект новой доски")}
              className="mt-1 w-full rounded-md border bg-background p-2"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">{t("Без папки")}</option>
              {organization?.sidebar.items
                .filter(
                  (item) =>
                    item.type === "folder" &&
                    (item.workspaceId ?? "default") ===
                      preferences.workspaceId &&
                    !item.archived
                )
                .map(
                  (item) =>
                    item.type === "folder" && (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    )
                )}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            {t("Режим можно сменить позже. Карточки сохраняются.")}{" "}
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? t("Создание…") : t("Создать доску")}
          </Button>
        </form>
      </ModalContent>
    </Modal>
  )
}
