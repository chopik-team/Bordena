import { formatLocalError } from "@/lib/local-error"
import { useState } from "react"
import { flushSync } from "react-dom"
import { useT } from "@bordena/i18n"
import {
  useDashboards,
  useCard,
  updateCard,
  queryClient,
  keys,
  type Card,
} from "@bordena/core"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Modal,
  ModalContent,
  ModalTitle,
  DateTimeCalendar,
} from "@bordena/ui-kit"
import { CalendarClock } from "lucide-react"
import { inlineDateUrl, parseInlineDate } from "@/lib/inline-date"
import type { TextSelectionAction } from "@bordena/editor"
import { applyOperations } from "@/lib/exchange/changeset"
import { webDb } from "@/lib/adapters/web-db"
import { openLocalLink } from "@/lib/local-links"
import { eventDefaults } from "@/lib/calendar-data"
import {
  CalendarStateSchema,
  emptyCalendarState,
  generalCalendar,
} from "@bordena/contract"
import { flushCardEdits } from "@bordena/core"
import { navigate } from "wouter/use-browser-location"

export function SelectionLinksDialog({
  selection,
  cardId,
  onClose,
}: {
  selection: TextSelectionAction | null
  cardId: string
  onClose: () => void
}) {
  const t = useT(),
    { data: boards = [] } = useDashboards(),
    [kind, setKind] = useState<"board" | "card">("board"),
    [target, setTarget] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const [mode, setMode] = useState<"actions" | "date" | "deadline">(() =>
    selection?.dateLink && parseInlineDate(selection.dateLink)
      ? "date"
      : "actions"
  )
  const { data: currentCard } = useCard(cardId)
  const { data: cards = [] } = useQuery({
    queryKey: [...keys.cards, "selection-targets"],
    queryFn: () => webDb.getAll<Card>("cards"),
    enabled: !!selection && mode === "actions",
  })
  const run = (action: () => Promise<string>) => {
    setBusy(true)
    setError("")
    void action()
      .then((url) => {
        if (!selection) return
        const label = selection.text.replace(/[\\[\]]/g, "\\$&")
        if (!selection.replace(`[${label}](${url})`)) {
          setError(
            t("Объект создан, но текст изменился. Вставьте ссылку вручную:") +
              ` ${url}`
          )
          return
        }
        onClose()
      })
      .catch((e) => setError(formatLocalError(e)))
      .finally(() => setBusy(false))
  }
  const schedule = (kind: "event" | "block") => {
    setBusy(true)
    setError("")
    void (async () => {
      if (selection?.eventLink) {
        await flushCardEdits()
        onClose()
        navigate(`/calendar?event=${selection.eventLink.split("/").at(-1)}`)
        return
      }
      const state = CalendarStateSchema.parse(
        (await webDb.get("meta", "bordena:calendar")) ?? emptyCalendarState()
      )
      const calendar =
        state.calendars.find(
          (c) => !c.deletedAt && c.id === currentCard?.calendarId
        ) ?? generalCalendar()
      const task = selection?.task,
        taskId = task?.id ?? crypto.randomUUID()
      if (task && !task.id) {
        let replaced = false
        flushSync(() => {
          replaced = task.replace(taskId)
        })
        if (!replaced)
          throw new Error(t("Текст изменился. Откройте календарь заново."))
      }
      await flushCardEdits()
      const source = await webDb.get<Card>("cards", cardId)
      if (!source || source.deletedAt) throw new Error(t("Карточка недоступна"))
      const inline = parseInlineDate(selection?.dateLink ?? "")
      const link = task
        ? { type: "checklist" as const, id: taskId, cardId }
        : inline
          ? { type: "inline-date" as const, id: inline.id, cardId }
          : { type: "card" as const, id: cardId }
      const existing =
        task || inline
          ? state.events.find(
              (e) =>
                !e.deletedAt &&
                e.status !== "cancelled" &&
                e.links.some(
                  (l) =>
                    l.type === link.type &&
                    l.id === link.id &&
                    l.cardId === link.cardId
                )
            )
          : undefined
      const event = existing ?? {
        ...eventDefaults(
          calendar.id,
          inline
            ? new Date(
                inline.value.length === 10
                  ? inline.value + "T10:00:00"
                  : inline.value
              )
            : new Date(),
          task?.text || selection?.text || source.title || t("Новое событие")
        ),
        kind: task ? ("block" as const) : kind,
        links: [link],
      }
      if (!existing)
        await applyOperations([{ op: "create-calendar-event", event }])
      if (!task && !inline && selection?.text) {
        let replaced = false
        flushSync(() => {
          replaced = selection.replace(
            `[${selection.text.replace(/[[\]]/g, "\\$&")}](bordena://event/${event.id})`
          )
        })
        if (!replaced)
          throw new Error(
            t("Объект создан, но текст изменился. Вставьте ссылку вручную:") +
              ` bordena://event/${event.id}`
          )
      }
      await flushCardEdits()
      onClose()
      navigate(`/calendar?event=${event.id}`)
    })()
      .catch((e) => setError(formatLocalError(e)))
      .finally(() => setBusy(false))
  }
  return (
    <Modal
      open={!!selection}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <ModalContent className="md:max-w-lg">
        <ModalTitle>
          {t(
            mode === "date"
              ? "Дата в тексте"
              : mode === "deadline"
                ? "Дата и время срока"
                : "Действия с текстом"
          )}
        </ModalTitle>
        <p className="my-3 max-h-24 overflow-auto text-sm break-words">
          {selection?.text}
        </p>
        {mode !== "actions" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t(
                mode === "date"
                  ? "Дата останется в тексте. Срок карточки задаётся отдельно."
                  : "Изменится срок карточки. Текст останется прежним."
              )}
            </p>
            <DateTimeCalendar
              value={
                mode === "deadline"
                  ? (currentCard?.deadline ?? null)
                  : (parseInlineDate(selection?.dateLink ?? "")?.value ?? null)
              }
              allowClear={mode === "deadline" || !!selection?.dateLink}
              onCancel={onClose}
              onSelect={(value) => {
                if (!selection || busy) return
                if (mode === "deadline") {
                  setBusy(true)
                  void updateCard(cardId, { deadline: value })
                    .then(async () => {
                      await queryClient.invalidateQueries({
                        queryKey: keys.cards,
                      })
                      onClose()
                    })
                    .catch((e) => setError(formatLocalError(e)))
                    .finally(() => setBusy(false))
                  return
                }
                const label = (selection.text || t("Дата")).replace(
                  /[\\[\]]/g,
                  "\\$&"
                )
                const id =
                  parseInlineDate(selection.dateLink ?? "")?.id ??
                  crypto.randomUUID()
                if (
                  selection.replace(
                    value ? `[${label}](${inlineDateUrl(value, id)})` : label
                  )
                )
                  onClose()
                else setError(t("Текст изменился. Откройте календарь заново."))
              }}
            />
            {mode === "date" && (
              <Button variant="ghost" onClick={() => setMode("actions")}>
                {t("Действия с текстом")}
              </Button>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => schedule("event")}
              >
                <CalendarClock />
                {t(
                  selection?.task
                    ? "Запланировать пункт чек-листа"
                    : selection?.eventLink
                      ? "Открыть календарное событие"
                      : "Добавить в календарь"
                )}
              </Button>
              {!selection?.task && !selection?.eventLink && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => schedule("block")}
                >
                  {t("Запланировать рабочий блок")}
                </Button>
              )}
              {selection?.eventLink && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (selection.replace(selection.text)) onClose()
                    else
                      setError(t("Текст изменился. Откройте календарь заново."))
                  }}
                >
                  {t("Удалить календарную связь")}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setMode("date")}>
                <CalendarClock className="size-4" />
                {t(
                  selection?.text ? "Привязать дату к слову" : "Вставить дату"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setMode("deadline")}>
                {t("Изменить срок карточки")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !selection?.text}
                variant="secondary"
                onClick={() =>
                  run(async () => {
                    const source = await webDb.get<Card>("cards", cardId)
                    if (!source || source.deletedAt)
                      throw new Error(t("Карточка недоступна"))
                    const id = crypto.randomUUID()
                    await applyOperations([
                      {
                        op: "create-card",
                        id,
                        columnId: source.columnId,
                        title: selection!.text,
                        body: "",
                      },
                    ])
                    return `bordena://card/${id}`
                  })
                }
              >
                {t("Создать задачу из выделения")}
              </Button>
              <Button
                disabled={busy || !selection?.text}
                variant="secondary"
                onClick={() =>
                  run(async () => {
                    const id = crypto.randomUUID()
                    await applyOperations([
                      {
                        op: "create-board",
                        id,
                        title: selection!.text,
                        mode: "free",
                      },
                      {
                        op: "apply-template",
                        boardId: id,
                        templateId: "builtin-free",
                        includeExamples: false,
                        includeAutomation: false,
                      },
                    ])
                    return `bordena://board/${id}`
                  })
                }
              >
                {t("Создать связанную доску")}
              </Button>
            </div>
            <label className="block text-sm">
              {t("Связать с существующим объектом")}
              <select
                className="mt-1 w-full rounded border bg-background p-2"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as typeof kind)
                  setTarget("")
                }}
              >
                <option value="board">{t("Доска")}</option>
                <option value="card">{t("Карточка")}</option>
              </select>
            </label>
            <select
              aria-label={t("Объект ссылки")}
              className="w-full rounded border bg-background p-2"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">{t("Выберите объект")}</option>
              {(kind === "board"
                ? boards
                : cards.filter((c) => !c.deletedAt && c.id !== cardId)
              ).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <Button
              disabled={!target || busy}
              onClick={() => run(async () => `bordena://${kind}/${target}`)}
            >
              {t("Вставить локальную ссылку")}
            </Button>
            {(selection?.link || selection?.text.includes("bordena://")) && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  const url =
                    selection!.link ??
                    selection!.text.match(
                      /bordena:\/\/(?:board|card)\/[a-zA-Z0-9_-]+/
                    )?.[0]
                  if (url)
                    void openLocalLink(url)
                      .then(onClose)
                      .catch((e) => setError(formatLocalError(e)))
                }}
              >
                {t("Открыть связанную сущность")}
              </Button>
            )}
            {error && (
              <p role="alert" className="text-sm break-words text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}
