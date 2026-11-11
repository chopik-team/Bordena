import { useEffect, useState, type ReactNode } from "react"
import { ThemeCtx, type Theme } from "./theme-context"
import { setPreferences, usePreferences } from "@/lib/preferences"
import { MotionConfig } from "motion/react"
import { useLocale } from "@bordena/i18n"

const DARK_QUERY = "(prefers-color-scheme: dark)"
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preferences = usePreferences(),
    locale = useLocale()
  const [system, setSystem] = useState<Theme>(() =>
    window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
  )
  const theme = preferences.theme === "system" ? system : preferences.theme
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY),
      change = () => setSystem(query.matches ? "dark" : "light")
    query.addEventListener("change", change)
    return () => query.removeEventListener("change", change)
  }, [])
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    root.lang = locale
    root.dataset.density = preferences.density
    root.dataset.animations = preferences.animations ? "on" : "off"
    root.dataset.panning = preferences.panning ? "on" : "off"
    root.dataset.scrolling = preferences.scrollBehavior
  }, [
    theme,
    locale,
    preferences.density,
    preferences.animations,
    preferences.panning,
    preferences.scrollBehavior,
  ])
  return (
    <ThemeCtx.Provider
      value={{ theme, setTheme: (next) => setPreferences({ theme: next }) }}
    >
      <MotionConfig reducedMotion={preferences.animations ? "user" : "always"}>
        {children}
      </MotionConfig>
    </ThemeCtx.Provider>
  )
}
