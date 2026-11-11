import { useT } from "@bordena/i18n"
import { useState } from "react"
import { Button } from "@bordena/ui-kit"
import {
  setPreferences,
  usePreferences,
  type Preferences,
} from "@/lib/preferences"
import { applyZoom, readZoom } from "@/lib/zoom"
import { isDesktop } from "@/lib/platform"
import { SettingsSection } from "../section"
export function PreferenceSelect<K extends keyof Preferences>({
  name,
  label,
  options,
}: {
  name: K
  label: string
  options: [Preferences[K], string][]
}) {
  const preferences = usePreferences(),
    t = useT()
  return (
    <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{t(label)}</span>
      <select
        className="rounded-md border bg-background p-2"
        aria-label={t(label)}
        value={String(preferences[name])}
        onChange={(event) => setPreferences({ [name]: event.target.value })}
      >
        {options.map(([value, title]) => (
          <option key={String(value)} value={String(value)}>
            {t(title)}
          </option>
        ))}
      </select>
    </label>
  )
}
export function PreferenceToggle({
  name,
  label,
}: {
  name:
    "animations" | "panning" | "restoreLastBoard" | "sidebarOpen" | "useTabs"
  label: string
}) {
  const preferences = usePreferences(),
    t = useT()
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{t(label)}</span>
      <input
        type="checkbox"
        checked={preferences[name]}
        onChange={(e) => setPreferences({ [name]: e.target.checked })}
      />
    </label>
  )
}
export function InterfaceSection() {
  const [zoom, setZoom] = useState(readZoom),
    [error, setError] = useState("")
  const t = useT()
  return (
    <SettingsSection title={t("Интерфейс")}>
      <PreferenceSelect
        name="theme"
        label={t("Тема")}
        options={[
          ["system", t("Как в системе")],
          ["light", t("Светлая")],
          ["dark", t("Тёмная")],
        ]}
      />
      <PreferenceSelect
        name="language"
        label={t("Язык")}
        options={[
          ["system", t("Как в системе")],
          ["ru", t("Русский")],
          ["en", "English"],
        ]}
      />
      <PreferenceSelect
        name="density"
        label={t("Плотность")}
        options={[
          ["normal", t("Обычная")],
          ["compact", t("Компактная")],
        ]}
      />
      <PreferenceToggle
        name="sidebarOpen"
        label={t("Показывать боковую панель")}
      />
      <PreferenceToggle name="animations" label={t("Мягкие анимации")} />
      <PreferenceToggle name="useTabs" label={t("Использовать вкладки")} />
      {isDesktop() && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{t("Масштаб интерфейса")}</span>
          <div className="flex items-center gap-2">
            {[-0.1, 0, 0.1].map((delta) => (
              <Button
                key={delta}
                size="sm"
                variant="secondary"
                aria-label={t(
                  delta < 0
                    ? "Уменьшить масштаб"
                    : delta > 0
                      ? "Увеличить масштаб"
                      : "Сбросить масштаб"
                )}
                onClick={() => {
                  const next = delta
                    ? Math.max(
                        0.5,
                        Math.min(2, Math.round((zoom + delta) * 10) / 10)
                      )
                    : 1
                  void applyZoom(next)
                    .then(() => setZoom(next))
                    .catch(() => setError(t("Не удалось изменить масштаб")))
                }}
              >
                {delta < 0
                  ? "−"
                  : delta > 0
                    ? "+"
                    : `${Math.round(zoom * 100)}%`}
              </Button>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </SettingsSection>
  )
}
export function BoardsSection() {
  const t = useT()
  return (
    <SettingsSection title={t("Доски и управление")}>
      <PreferenceSelect
        name="defaultMode"
        label={t("Режим новой доски")}
        options={[
          ["free", t("Свободный")],
          ["matrix", t("Матрица")],
        ]}
      />
      <PreferenceToggle
        name="restoreLastBoard"
        label={t("Открывать последнюю доску при запуске")}
      />
      <PreferenceToggle
        name="panning"
        label={t("Перемещать доску средней кнопкой мыши")}
      />
      <PreferenceSelect
        name="scrollBehavior"
        label={t("Прокрутка доски")}
        options={[
          ["auto", t("Обычная")],
          ["smooth", t("Плавная")],
        ]}
      />
      <p className="text-xs text-muted-foreground">
        {t(
          "Готовность новых секций выключена. Включите её в меню нужной секции. Перетаскивайте секцию за ручку рядом с названием."
        )}
      </p>
    </SettingsSection>
  )
}
