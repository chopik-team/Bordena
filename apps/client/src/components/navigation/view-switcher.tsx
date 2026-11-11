import { useT } from "@bordena/i18n"
export function ViewSwitcher({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const t = useT()
  return (
    <>
      <div
        role="group"
        aria-label={t(label)}
        className="bordena-view-switch hidden items-center rounded-lg border bg-muted/40 p-1 xl:inline-flex"
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-primary/20 aria-pressed:text-foreground"
          >
            {t(option.label)}
          </button>
        ))}
      </div>
      <select
        aria-label={t(label)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bordena-view-select max-w-44 rounded-lg border bg-background px-2 py-2 text-sm xl:hidden"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </select>
    </>
  )
}
