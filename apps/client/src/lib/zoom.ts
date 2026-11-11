import { isDesktop } from "./platform"

const STORAGE_KEY = "zoom"
const STEP = 0.1
const MIN = 0.5
const MAX = 2
const DEFAULT = 1

function clamp(value: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(value * 10) / 10))
}

export function readZoom(): number {
  const saved = Number(localStorage.getItem(STORAGE_KEY))
  return saved >= MIN && saved <= MAX ? saved : DEFAULT
}

export async function applyZoom(level: number): Promise<void> {
  level = clamp(level)
  localStorage.setItem(STORAGE_KEY, String(level))
  const { getCurrentWebviewWindow } =
    await import("@tauri-apps/api/webviewWindow")
  await getCurrentWebviewWindow().setZoom(level)
}

/**
 * Cmd/Ctrl +/-/0 zoom for the whole app, persisted across launches. Desktop
 * only — browsers already zoom natively, so we leave those shortcuts alone.
 */
export function initZoom(): void {
  if (!isDesktop()) return

  void applyZoom(readZoom())

  window.addEventListener("keydown", (e) => {
    if (!e.metaKey && !e.ctrlKey) return

    if (e.key === "=" || e.key === "+") {
      e.preventDefault()
      void applyZoom(readZoom() + STEP)
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault()
      void applyZoom(readZoom() - STEP)
    } else if (e.key === "0") {
      e.preventDefault()
      void applyZoom(DEFAULT)
    }
  })
}
