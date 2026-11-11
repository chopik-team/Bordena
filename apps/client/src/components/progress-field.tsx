import { useT } from "@bordena/i18n"
import { useRef, useState } from "react"
/** Blank is null; it never silently becomes zero. Commit only a finite value in range. */
export function ProgressField({
  value,
  onCommit,
  label,
}: {
  value?: number | null
  onCommit: (value: number | null) => void
  label?: string
}) {
  const t = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const submitted = useRef<string | null>(null)
  const displayed = draft ?? (value == null ? "" : String(value))
  const invalid =
    displayed !== "" &&
    (!Number.isFinite(Number(displayed)) ||
      Number(displayed) < 0 ||
      Number(displayed) > 100)
  const commit = () => {
    if (invalid) return
    if (draft === null || submitted.current === displayed) return
    const next = displayed.trim() === "" ? null : Number(displayed)
    // Keep the committed draft until the durable value comes back. Clearing it
    // here would let the following blur submit the old blank value over a 0.
    submitted.current = displayed
    if ((value ?? null) !== next) onCommit(next)
  }
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {label ?? t("Готовность")}
      <input
        type="number"
        min={0}
        max={100}
        step="any"
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder="—"
        value={displayed}
        onChange={(e) => {
          submitted.current = null
          setDraft(e.target.value)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          }
          if (e.key === "Escape") {
            submitted.current = null
            setDraft(null)
          }
        }}
        className="w-17 rounded-md border bg-background px-2 py-1 text-foreground focus-visible:outline-2"
      />
      %{invalid && <span role="alert">{t("От 0 до 100")}</span>}
    </label>
  )
}
export function ProgressIndicator({ value }: { value?: number | null }) {
  const t = useT()
  if (value == null) return null
  return (
    <div
      className="mt-2 flex items-center gap-2"
      aria-label={t("Готовность: {p0}%", { p0: value })}
    >
      <div
        role="progressbar"
        aria-label={t("Готовность карточки")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary/65"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {value}%
      </span>
    </div>
  )
}
