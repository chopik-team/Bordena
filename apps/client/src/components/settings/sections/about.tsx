import { useT } from "@bordena/i18n"
import logo from "@/assets/bordena-logo.png"
import license from "../../../../../../LICENSE?raw"
import notice from "../../../../../../docs/THIRD_PARTY_NOTICES.txt?raw"
import { SettingsSection } from "../section"
import { AUTHOR_SUPPORT_URL } from "@/lib/external-links"
import { BoostyIcon } from "@/components/boosty-icon"

export function AboutSection() {
  const t = useT()
  return (
    <SettingsSection>
      <div className="flex items-center gap-4">
        <img src={logo} alt="" className="size-20 object-contain" />
        <div>
          <h3 className="text-xl font-semibold">Bordena {__APP_VERSION__}</h3>
          <p className="mt-1 text-muted-foreground">
            {t("Локальное пространство для ваших проектов")}
          </p>
        </div>
      </div>
      <p>
        {t(
          "Доски, заметки, задачи и вложения на вашем компьютере. Работа без регистрации и подключения к интернету."
        )}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
        <dt>{t("Автор")}</dt>
        <dd>{t("Станислав Смирнов")}</dd>
        <dt>{t("Разработчик")}</dt>
        <dd>CHOPIK Team</dd>
        <dt>{t("Лицензия")}</dt>
        <dd>MIT</dd>
      </dl>
      <a
        href={AUTHOR_SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit max-w-full items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-2"
      >
        <BoostyIcon className="size-4 shrink-0" />
        {t("Поддержать разработчика")} · Boosty
      </a>
      <p className="text-sm text-muted-foreground">
        {t(
          "В Bordena использована часть кода Doska. Автор Doska — Margarita Romenkova, copyright © 2026. Уведомления и условия исходной лицензии сохранены."
        )}
      </p>
      <details>
        <summary className="cursor-pointer py-2">{t("Лицензия MIT")}</summary>
        <pre className="text-xs whitespace-pre-wrap">{license}</pre>
      </details>
      <details>
        <summary className="cursor-pointer py-2">
          {t("Сторонние компоненты")}
        </summary>
        <pre className="text-xs whitespace-pre-wrap">{notice}</pre>
      </details>
    </SettingsSection>
  )
}
