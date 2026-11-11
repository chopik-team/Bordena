import { useSyncExternalStore } from "react"
import { setLanguage } from "@bordena/i18n"
import { z } from "zod"

export const PreferencesSchema = z
  .object({
    language: z.enum(["system", "ru", "en"]),
    theme: z.enum(["system", "light", "dark"]),
    density: z.enum(["normal", "compact"]),
    animations: z.boolean(),
    panning: z.boolean(),
    restoreLastBoard: z.boolean(),
    defaultMode: z.enum(["free", "matrix"]),
    sidebarOpen: z.boolean(),
    workspaceId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
    showArchived: z.boolean(),
    scrollBehavior: z.enum(["auto", "smooth"]),
    automaticBackups: z.number().int().min(0).max(100).optional(),
    windowsNotifications: z.boolean().optional(),
    useTabs: z.boolean().optional(),
  })
  .strict()

export interface Preferences {
  language: "system" | "ru" | "en"
  theme: "system" | "light" | "dark"
  density: "normal" | "compact"
  animations: boolean
  panning: boolean
  restoreLastBoard: boolean
  defaultMode: "free" | "matrix"
  sidebarOpen: boolean
  workspaceId: string
  showArchived: boolean
  scrollBehavior: "auto" | "smooth"
  automaticBackups: number
  windowsNotifications: boolean
  useTabs: boolean
}
const KEY = "bordena:preferences:v1"
const defaults: Preferences = {
  language: "system",
  theme: "system",
  density: "normal",
  animations: true,
  panning: true,
  restoreLastBoard: true,
  defaultMode: "free",
  sidebarOpen: true,
  workspaceId: "default",
  showArchived: false,
  scrollBehavior: "auto",
  automaticBackups: 3,
  windowsNotifications: false,
  useTabs: false,
}
export function parsePreferences(raw: string | null): Preferences {
  let value: Record<string, unknown> = {}
  try {
    value = JSON.parse(raw ?? "{}") ?? {}
  } catch {
    /* Defaults keep a damaged preference file from blocking data access. */
  }
  const choice = <T extends string>(
    key: keyof Preferences,
    allowed: T[],
    fallback: T
  ): T => (allowed.includes(value[key] as T) ? (value[key] as T) : fallback)
  const flag = (key: keyof Preferences) =>
    typeof value[key] === "boolean"
      ? (value[key] as boolean)
      : (defaults[key] as boolean)
  return {
    language: choice("language", ["ru", "en", "system"], "system"),
    theme: choice("theme", ["light", "dark", "system"], "system"),
    density: choice("density", ["normal", "compact"], "normal"),
    animations: flag("animations"),
    panning: flag("panning"),
    restoreLastBoard: flag("restoreLastBoard"),
    defaultMode: choice("defaultMode", ["free", "matrix"], "free"),
    sidebarOpen: flag("sidebarOpen"),
    workspaceId:
      typeof value.workspaceId === "string" &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(value.workspaceId)
        ? value.workspaceId
        : "default",
    showArchived: flag("showArchived"),
    useTabs: flag("useTabs"),
    scrollBehavior: choice("scrollBehavior", ["auto", "smooth"], "auto"),
    automaticBackups:
      Number.isInteger(value.automaticBackups) &&
      Number(value.automaticBackups) >= 0 &&
      Number(value.automaticBackups) <= 100
        ? Number(value.automaticBackups)
        : 3,
    windowsNotifications:
      typeof value.windowsNotifications === "boolean"
        ? value.windowsNotifications
        : false,
  }
}
let current: Preferences | undefined
const listeners = new Set<() => void>()
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return
    current = parsePreferences(event.newValue)
    setLanguage(current.language)
    listeners.forEach((fn) => fn())
  })
export function preferencesSnapshot(): Preferences {
  if (!current) {
    try {
      const raw = localStorage.getItem(KEY)
      current = parsePreferences(raw)
      if (raw === null) {
        const oldTheme = localStorage.getItem("theme"),
          oldSidebar = localStorage.getItem("bordena:sidebar-open")
        if (oldTheme === "dark" || oldTheme === "light")
          current.theme = oldTheme
        if (oldSidebar !== null) current.sidebarOpen = oldSidebar === "true"
      }
    } catch {
      current = { ...defaults }
    }
  }
  return current
}
export function setPreferences(patch: Partial<Preferences>): void {
  current = parsePreferences(
    JSON.stringify({ ...preferencesSnapshot(), ...patch })
  )
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* The current session remains usable. */
  }
  setLanguage(current.language)
  listeners.forEach((fn) => fn())
}
export function usePreferences(): Preferences {
  return useSyncExternalStore((fn) => {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, preferencesSnapshot)
}
