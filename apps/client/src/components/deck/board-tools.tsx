import { formatLocalError } from "@/lib/local-error"
import { useState, useRef } from "react"
import { useT } from "@bordena/i18n"
import { useBoard, initialLayout, type Dashboard } from "@bordena/core"
import {
  Button,
  Modal,
  ModalContent,
  ModalTitle,
  DateInput,
  formatDeadline,
} from "@bordena/ui-kit"
import { FieldDefinitionSchema } from "@bordena/contract"
import { applyOperations, type Template } from "@/lib/exchange/changeset"
import { saveExchange, pickExchange } from "@/lib/exchange/files"
import { BoardTemplateSchema } from "@bordena/contract"
import { ColorSelect } from "../column/column-color"
import { useCalendarState } from "@/lib/calendar-data"
import { GENERAL_CALENDAR_ID } from "@bordena/contract"

export function BoardTools({
  dashboard,
  open: controlledOpen,
  onOpenChange,
  dialogOnly = false,
  initialSection,
}: {
  dashboard: Dashboard
  open?: boolean
  onOpenChange?: (open: boolean) => void
  dialogOnly?: boolean
  initialSection?: "fields"
}) {
  const jumped = useRef(false)
  const { data: calendarState } = useCalendarState()
  const t = useT(),
    { data: board } = useBoard(dashboard.id),
    [localOpen, setLocalOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("")
  const open = controlledOpen ?? localOpen
  const setOpen = onOpenChange ?? setLocalOpen
  const [draft, setDraft] = useState(dashboard),
    [fieldTitle, setFieldTitle] = useState(""),
    [fieldType, setFieldType] =
      useState<NonNullable<Dashboard["fieldDefinitions"]>[number]["type"]>(
        "text"
      ),
    [options, setOptions] = useState("")
  const run = (fn: () => Promise<void>) => {
    setBusy(true)
    setMessage("")
    void fn()
      .catch((e) => setMessage(formatLocalError(e)))
      .finally(() => setBusy(false))
  }
  const template = (): Template => {
    const layout = structuredClone(
      dashboard.layout ?? initialLayout(board?.columns ?? [], "free")
    )
    const sections: Template["sections"] = (board?.columns ?? []).map((c) => ({
      sourceId: c.id,
      title: c.title,
      color: c.color,
      done: c.done,
      progressMode: layout.sections[c.id]?.progressMode ?? "off",
    }))
    if (!sections.length) {
      sections.push({
        sourceId: "template-tasks",
        title: t("Карточки"),
        color: "blue",
        done: false,
        progressMode: dashboard.goalPath ? "manual" : "off",
      })
      layout.sections["template-tasks"] = {
        laneId: layout.lanes[0].id,
        stageId: layout.stages[0].id,
        stateId: layout.states[0].id,
        progressMode: dashboard.goalPath ? "manual" : "off",
      }
    }
    return {
      id: crypto.randomUUID(),
      title: dashboard.title,
      category: "Пользовательские",
      mode: dashboard.layout?.mode ?? "free",
      layout,
      goalPath: dashboard.goalPath
        ? {
            ...structuredClone(dashboard.goalPath),
            manualProgress: null,
            steps: dashboard.goalPath.steps.map((s) => ({
              ...s,
              status: "not-started",
              skipped: false,
            })),
            metrics: dashboard.goalPath.metrics.map((m) => ({
              ...m,
              current: null,
              history: [],
            })),
          }
        : undefined,
      sections,
      fields: dashboard.fieldDefinitions ?? [],
      examples: [],
    }
  }
  return (
    <>
      {!dialogOnly && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(dashboard)
            setOpen(true)
          }}
        >
          {t("Параметры доски")}
        </Button>
      )}
      <Modal open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <ModalContent className="max-h-[85vh] overflow-y-auto md:max-w-xl">
          <ModalTitle>{t("Параметры доски")}</ModalTitle>
          <label className="mt-4 block text-sm">
            {t("Календарь по умолчанию")}
            <select
              aria-label={t("Календарь по умолчанию")}
              className="mt-1 w-full rounded border bg-background p-2"
              value={draft.defaultCalendarId ?? GENERAL_CALENDAR_ID}
              onChange={(e) =>
                setDraft({ ...draft, defaultCalendarId: e.target.value })
              }
            >
              {calendarState?.calendars
                .filter((c) => !c.deletedAt)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id === GENERAL_CALENDAR_ID
                      ? t("Общий календарь")
                      : c.title}
                  </option>
                ))}
              {draft.defaultCalendarId &&
                !calendarState?.calendars.some(
                  (c) => c.id === draft.defaultCalendarId && !c.deletedAt
                ) && (
                  <option value={draft.defaultCalendarId}>
                    {t("Календарь недоступен")}
                  </option>
                )}
            </select>
            <span className="text-xs text-muted-foreground">
              {t(
                "Предлагается для новых блоков. Существующие записи не меняются."
              )}
            </span>
          </label>
          <div className="mt-4 space-y-4 text-sm">
            <label className="flex items-center justify-between gap-2">
              {t("Цвет доски")}
              <ColorSelect
                label={t("Цвет доски")}
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              {t("Приоритет")}
              <select
                className="rounded border bg-background p-2"
                value={draft.priority ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priority: e.target.value as Dashboard["priority"],
                  })
                }
              >
                {["", "low", "medium", "high"].map((value) => (
                  <option key={value} value={value}>
                    {t(
                      value === "high"
                        ? "Высокий"
                        : value === "medium"
                          ? "Средний"
                          : value === "low"
                            ? "Низкий"
                            : "Без приоритета"
                    )}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {t("Срок проекта")}
              <DateInput
                withTime
                value={draft.deadline ?? null}
                onChange={(deadline) => setDraft({ ...draft, deadline })}
                inputProps={{ "aria-label": t("Срок проекта") }}
                className="rounded border px-3 py-2 hover:bg-accent"
              >
                {draft.deadline
                  ? formatDeadline(draft.deadline)
                  : t("Выбрать дату…")}
              </DateInput>
            </div>
            <label className="flex items-center justify-between gap-2">
              {t("Ручная готовность доски")}
              <input
                className="w-24 rounded border bg-background p-2"
                aria-label={t("Ручная готовность доски")}
                type="number"
                min="0"
                max="100"
                value={draft.progress ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    progress:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <fieldset
              ref={(node) => {
                if (node && initialSection === "fields" && !jumped.current) {
                  jumped.current = true
                  requestAnimationFrame(() => {
                    node.scrollIntoView({ block: "start" })
                    node.querySelector("input")?.focus({ preventScroll: true })
                  })
                }
              }}
              className="space-y-2 rounded border p-3"
            >
              <legend>{t("Дополнительные поля")}</legend>
              {draft.fieldDefinitions?.map((field) => (
                <div key={field.id} className="flex gap-2">
                  <span className="min-w-0 flex-1 break-words">
                    {field.title}
                  </span>
                  <span className="text-muted-foreground">{t(field.type)}</span>
                </div>
              ))}
              <input
                className="w-full rounded border bg-background p-2"
                aria-label={t("Название поля")}
                placeholder={t("Название поля")}
                value={fieldTitle}
                onChange={(e) => setFieldTitle(e.target.value)}
              />
              <select
                aria-label={t("Тип поля")}
                className="rounded border bg-background p-2"
                value={fieldType}
                onChange={(e) =>
                  setFieldType(e.target.value as typeof fieldType)
                }
              >
                {[
                  "text",
                  "number",
                  "date",
                  "percent",
                  "checkbox",
                  "select",
                ].map((type) => (
                  <option key={type} value={type}>
                    {t(type)}
                  </option>
                ))}
              </select>
              {fieldType === "select" && (
                <input
                  aria-label={t("Варианты через запятую")}
                  className="w-full rounded border bg-background p-2"
                  placeholder={t("Варианты через запятую")}
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                />
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={
                  !fieldTitle.trim() ||
                  (draft.fieldDefinitions?.length ?? 0) >= 100
                }
                onClick={() => {
                  try {
                    const field = FieldDefinitionSchema.parse({
                      id: crypto.randomUUID(),
                      title: fieldTitle.trim(),
                      type: fieldType,
                      options:
                        fieldType === "select"
                          ? options
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : undefined,
                    })
                    setDraft({
                      ...draft,
                      fieldDefinitions: [
                        ...(draft.fieldDefinitions ?? []),
                        field,
                      ],
                    })
                    setFieldTitle("")
                  } catch (e) {
                    setMessage(formatLocalError(e))
                  }
                }}
              >
                {t("Добавить поле")}
              </Button>
            </fieldset>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await applyOperations([
                    {
                      op: "update-board",
                      id: dashboard.id,
                      expectedUpdatedAt: dashboard.updatedAt,
                      patch: {
                        color: draft.color,
                        defaultCalendarId: draft.defaultCalendarId,
                        priority: draft.priority,
                        deadline: draft.deadline,
                        progress: draft.progress,
                        fieldDefinitions: draft.fieldDefinitions,
                      },
                    },
                  ])
                  setOpen(false)
                })
              }
            >
              {t("Сохранить")}
            </Button>
            <details>
              <summary className="cursor-pointer py-2">
                {t("Шаблоны доски")}
              </summary>
              <p className="mb-2 text-xs text-muted-foreground">
                {t(
                  "Сохраняется структура без карточек, вложений, связей и истории."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !board}
                  onClick={() =>
                    run(async () => {
                      await applyOperations([
                        { op: "save-template", template: template() },
                      ])
                      setMessage(t("Шаблон сохранён"))
                    })
                  }
                >
                  {t("Сохранить как шаблон")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !board}
                  onClick={() =>
                    run(async () => {
                      const data = {
                        format: "bordena-template",
                        schemaVersion: 1,
                        template: template(),
                      }
                      await saveExchange(
                        new TextEncoder().encode(JSON.stringify(data, null, 2)),
                        "json",
                        "template"
                      )
                    })
                  }
                >
                  {t("Экспорт шаблона")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const bytes = await pickExchange()
                      if (!bytes) return
                      const value = JSON.parse(new TextDecoder().decode(bytes))
                      if (
                        value.format !== "bordena-template" ||
                        value.schemaVersion !== 1
                      )
                        throw new Error(t("Неверный формат шаблона"))
                      await applyOperations([
                        {
                          op: "save-template",
                          template: BoardTemplateSchema.parse(value.template),
                        },
                      ])
                      setMessage(t("Шаблон сохранён"))
                    })
                  }
                >
                  {t("Импорт шаблона")}
                </Button>
              </div>
            </details>
            {message && (
              <p role="status" className="break-words">
                {message}
              </p>
            )}
          </div>
        </ModalContent>
      </Modal>
    </>
  )
}
