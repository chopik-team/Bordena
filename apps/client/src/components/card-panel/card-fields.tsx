import { formatLocalError } from "@/lib/local-error"
import { useT } from "@bordena/i18n"
import {
  useCard,
  useCardCol,
  useDashboards,
  useUpdateCard,
} from "@bordena/core"
import { useState } from "react"
import { validateFieldValues } from "@bordena/core"
export function CardFields({ cardId }: { cardId: string }) {
  const t = useT(),
    { data: card } = useCard(cardId),
    { data: column } = useCardCol(cardId),
    { data: boards = [] } = useDashboards()
  const { mutateAsync: save } = useUpdateCard(cardId),
    [error, setError] = useState("")
  const fields =
    boards.find((b) => b.id === column?.dashboardId)?.fieldDefinitions ?? []
  if (!card || !fields.length) return null
  return (
    <details className="border-b px-4 py-2 text-sm">
      <summary className="cursor-pointer py-1">
        {t("Дополнительные поля")}
      </summary>
      <div className="space-y-3 py-2">
        {fields.map((field) => {
          const value = card.fieldValues?.[field.id] ?? null
          const commit = (value: string | number | boolean | null) => {
            const fieldValues = { ...card.fieldValues, [field.id]: value }
            try {
              validateFieldValues({ ...card, fieldValues }, fields)
              setError("")
              void save({ fieldValues }).catch((e) =>
                setError(formatLocalError(e))
              )
            } catch (e) {
              setError(formatLocalError(e))
            }
          }
          return (
            <label
              key={field.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              {field.title}
              {field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => commit(e.target.checked)}
                />
              ) : field.type === "select" ? (
                <select
                  value={String(value ?? "")}
                  className="max-w-full rounded border bg-background p-2"
                  onChange={(e) => commit(e.target.value || null)}
                >
                  <option value="">—</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  key={`${field.id}-${value}`}
                  defaultValue={String(value ?? "")}
                  className="max-w-full rounded border bg-background p-2"
                  type={
                    field.type === "date"
                      ? "date"
                      : ["number", "percent"].includes(field.type)
                        ? "number"
                        : "text"
                  }
                  min={field.type === "percent" ? 0 : undefined}
                  max={field.type === "percent" ? 100 : undefined}
                  onBlur={(e) =>
                    commit(
                      e.target.value === ""
                        ? null
                        : ["number", "percent"].includes(field.type)
                          ? Number(e.target.value)
                          : e.target.value
                    )
                  }
                />
              )}
            </label>
          )
        })}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  )
}
