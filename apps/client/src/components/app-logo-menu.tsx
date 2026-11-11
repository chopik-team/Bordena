import { Info, History, Settings, BookOpen, LogOut } from "lucide-react"
import { BoostyIcon } from "./boosty-icon"
import { AUTHOR_SUPPORT_URL } from "@/lib/external-links"
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  MenuSeparator,
} from "@bordena/ui-kit"
import { useT } from "@bordena/i18n"
import { reportError } from "@bordena/core"
import { openAppSettings } from "@/lib/app-settings"
import { isDesktop } from "@/lib/platform"
import logo from "../assets/bordena-logo.png"
import { useUiFlag } from "@/lib/ui-state"
import { usePreferences, setPreferences } from "@/lib/preferences"

/** A single settings center owns every global application panel. */
export function AppLogoMenu() {
  const t = useT()
  const [focus, setFocus] = useUiFlag("focus")
  const { density } = usePreferences()
  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              className="app-logo-trigger h-auto w-full justify-start gap-2 px-2 py-2"
              aria-label={t("Меню Bordena")}
              tooltip={false}
            />
          }
        >
          <img
            src={logo}
            className="app-logo-image size-10 shrink-0 object-contain"
            alt=""
            draggable={false}
          />
          <span className="text-base font-semibold">Bordena</span>
        </MenuTrigger>
        <MenuContent
          align="start"
          className="w-72 max-w-[calc(100vw-24px)] [&_[data-slot=menu-item]]:min-w-0 [&_[data-slot=menu-item]]:break-words"
        >
          <MenuItem onClick={() => openAppSettings("interface")}>
            <Settings />
            {t("Настройки Bordena")}
          </MenuItem>
          <MenuItem onClick={() => openAppSettings("about")}>
            <Info />
            {t("О программе")}
          </MenuItem>
          <MenuItem onClick={() => openAppSettings("guide")}>
            <BookOpen />
            {t("Руководство пользователя")}
          </MenuItem>
          <MenuItem onClick={() => openAppSettings("changes")}>
            <History />
            {t("История изменений")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onClick={() =>
              setPreferences({
                density: density === "compact" ? "normal" : "compact",
              })
            }
          >
            {t("Компактный режим")} ·{" "}
            {t(density === "compact" ? "Включено" : "Выключено")}
          </MenuItem>
          <MenuItem onClick={() => setFocus(!focus)}>
            {t(focus ? "Выйти из фокуса" : "Фокусный режим")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            render={
              <a
                href={AUTHOR_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <BoostyIcon />
            {t("Поддержать разработчика")}
          </MenuItem>
          {isDesktop() && (
            <>
              <MenuSeparator />
              <MenuItem
                onClick={() =>
                  void import("@tauri-apps/api/window")
                    .then(({ getCurrentWindow }) => getCurrentWindow().close())
                    .catch(reportError)
                }
              >
                <LogOut />
                {t("Выход")}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
    </>
  )
}
