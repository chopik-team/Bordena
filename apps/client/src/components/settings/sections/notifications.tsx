import { useT } from "@bordena/i18n"
import { usePreferences, setPreferences } from "@/lib/preferences"
import { SettingsSection } from "../section"
export function NotificationsSection() {
  const t = useT(),
    preferences = usePreferences()
  return (
    <SettingsSection title={t("Уведомления")}>
      <label className="flex items-center justify-between gap-3 text-sm">
        {t("Показывать уведомления Windows")}
        <input
          type="checkbox"
          checked={preferences.windowsNotifications}
          onChange={(e) =>
            setPreferences({ windowsNotifications: e.target.checked })
          }
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {t(
          "По умолчанию выключены. Проверка сроков работает, пока Bordena запущена. Настройки Windows могут скрывать уведомления."
        )}
      </p>
    </SettingsSection>
  )
}
