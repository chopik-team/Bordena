import { useState, type ReactNode } from "react"
import { useT } from "@bordena/i18n"
import { CalendarClock } from "lucide-react"
import { DateInput, formatDeadline } from "@bordena/ui-kit"
import {
  flushCardEdits,
  updateCard,
  queryClient,
  keys,
  type Card,
} from "@bordena/core"
import { webDb } from "@/lib/adapters/web-db"
import { parseInlineDate, replaceInlineDate } from "@/lib/inline-date"
import { formatLocalError } from "@/lib/local-error"

/** Reuses the deadline picker while keeping an inline date independent of task completion. */
export function InlineDateLink({
  cardId,
  url,
  children,
  body,
  onChangeBody,
}: {
  cardId: string
  url: string
  children: ReactNode
  body?: string
  onChangeBody?: (body: string) => void
}) {
  const t = useT(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false)
  const date = parseInlineDate(url)!
  const change = async (value: string | null) => {
    setError("")
    setBusy(true)
    try {
      if (body !== undefined && onChangeBody)
        onChangeBody(replaceInlineDate(body, url, value))
      else {
        await flushCardEdits()
        const card = await webDb.get<Card>("cards", cardId)
        if (!card || card.deletedAt) throw new Error(t("Карточка недоступна"))
        await updateCard(
          cardId,
          { body: replaceInlineDate(card.body, url, value) },
          { body: card.body }
        )
        await queryClient.invalidateQueries({ queryKey: keys.cards })
      }
    } catch (error) {
      setError(formatLocalError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <span
      className="inline-flex max-w-full flex-wrap items-baseline gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <DateInput
        withTime
        value={date.value}
        onChange={(value) => void change(value)}
        inputProps={{
          "aria-label": t("Изменить дату в тексте"),
          title: formatDeadline(date.value),
          disabled: busy,
        }}
        className="inline-flex items-center gap-1 rounded-sm text-primary underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <CalendarClock className="inline size-3.5 shrink-0" />
        {children}
        <span className="text-[0.75em] opacity-80">
          {formatDeadline(date.value)}
        </span>
      </DateInput>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
