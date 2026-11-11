import {
  Button,
  MenuSub,
  MenuSubTrigger,
  MenuContent,
  MenuItem,
} from "@bordena/ui-kit"
import { useT } from "@bordena/i18n"
import { useUiFlag } from "@/lib/ui-state"
import { setPreferences, usePreferences } from "@/lib/preferences"

export function PresentationItems() {
  const t = useT(),
    [focus, setFocus] = useUiFlag("focus"),
    prefs = usePreferences()
  return (
    <MenuSub>
      <MenuSubTrigger>{t("Представление")}</MenuSubTrigger>
      <MenuContent>
        <MenuItem onClick={() => setFocus(!focus)}>
          {t(focus ? "Выйти из фокуса" : "Фокусный режим")}
        </MenuItem>
        <MenuItem
          onClick={() =>
            setPreferences({
              density: prefs.density === "compact" ? "normal" : "compact",
            })
          }
        >
          {t("Компактный режим")}
        </MenuItem>
        <MenuItem onClick={() => setPreferences({ useTabs: !prefs.useTabs })}>
          {t("Использовать вкладки")}
          {prefs.useTabs ? " ✓" : ""}
        </MenuItem>
      </MenuContent>
    </MenuSub>
  )
}
export function FocusExit() {
  const t = useT(),
    [focus, setFocus] = useUiFlag("focus")
  return focus ? (
    <Button
      data-focus-exit
      variant="secondary"
      size="sm"
      onClick={() => setFocus(false)}
    >
      {t("Выйти из фокуса")}
    </Button>
  ) : null
}
