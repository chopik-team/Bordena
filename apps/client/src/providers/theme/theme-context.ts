import { createContext, useContext } from "react"

export type Theme = "dark" | "light"

export interface ThemeValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeCtx = createContext<ThemeValue | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeCtx)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
