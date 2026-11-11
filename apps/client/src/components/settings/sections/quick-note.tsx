import { useT } from "@bordena/i18n"
import { Button } from "@bordena/ui-kit"
import { isDesktop } from "@/lib/platform"
import { formatShortcut } from "@/lib/shortcuts/format"
import { useRecordShortcut } from "@/lib/shortcuts/use-record-shortcut"
import { SettingsSection } from "../section"
/** The global hotkey that opens the quick-note popup; desktop only. */
export function QuickNoteSection() {
  if (!isDesktop()) return null
  return <Shortcut />
}
function Shortcut() {
  const t = useT()
  const { value, recording, error, start, clear } =
    useRecordShortcut("quick-note")
  return (
    <SettingsSection title={t("Быстрая заметка")}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="text-sm">{t("Горячая клавиша")}</span>
          <span className="text-xs text-muted-foreground">
            {error ?? t("Открывает быструю заметку поверх других приложений.")}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-w-24 font-mono"
            onClick={start}
          >
            {recording
              ? t("Нажмите сочетание…")
              : value
                ? formatShortcut(value)
                : t("Задать")}
          </Button>
          {value && !recording && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              {t("Очистить")}{" "}
            </Button>
          )}
        </span>
      </div>
    </SettingsSection>
  )
}
