import { formatLocalError } from "@/lib/local-error"
import { useState } from "react"
import { useT } from "@bordena/i18n"
import { useCard, useDashboards, useBoard } from "@bordena/core"
import { Button } from "@bordena/ui-kit"
import { applyOperations } from "@/lib/exchange/changeset"
import { generateKeyBetween } from "fractional-indexing"
export function MirrorEditor({ cardId }: { cardId: string }) {
  const t = useT(),
    { data: card } = useCard(cardId),
    { data: boards = [] } = useDashboards()
  const [target, setTarget] = useState(""),
    [section, setSection] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false)
  const { data: board } = useBoard(target)
  return (
    <details className="border-b px-4 py-2 text-sm">
      <summary className="cursor-pointer py-1">{t("Зеркала карточки")}</summary>
      <p className="py-2 text-xs text-muted-foreground">
        {t(
          "Зеркало показывает исходную задачу. Перенос зеркала меняет только его расположение."
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={t("Доска для зеркала")}
          value={target}
          onChange={(e) => {
            setTarget(e.target.value)
            setSection("")
          }}
          className="max-w-full rounded border bg-background p-2"
        >
          <option value="">{t("Выберите доску")}</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Секция зеркала")}
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="max-w-full rounded border bg-background p-2"
        >
          <option value="">{t("Выберите секцию")}</option>
          {board?.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!card || !target || !section || busy}
          onClick={() => {
            setBusy(true)
            setError("")
            void applyOperations([
              {
                op: "create-mirror",
                boardId: target,
                mirror: {
                  id: crypto.randomUUID(),
                  sourceCardId: cardId,
                  columnId: section,
                  position: generateKeyBetween(null, null),
                },
              },
            ])
              .catch((e) => setError(formatLocalError(e)))
              .finally(() => setBusy(false))
          }}
        >
          {t("Создать зеркало")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </details>
  )
}
