import { useSyncExternalStore } from "react"
import { runtime } from "../runtime"
import type { DashboardView } from "../types"

const BOARD_VIEWS_KEY = "bordena:board-views"

let views: Record<string, DashboardView> | null = null

const listeners = new Set<() => void>()

function load(): Record<string, DashboardView> {
  if (views) return views
  const stored = runtime().kv.get(BOARD_VIEWS_KEY)
  try {
    views = stored ? (JSON.parse(stored) as Record<string, DashboardView>) : {}
  } catch {
    // Unreadable storage is not worth failing a render over.
    views = {}
  }
  return views
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setBoardView(id: string, view: DashboardView): void {
  const current = load()
  if (current[id] === view) return
  views = { ...current, [id]: view }
  runtime().kv.set(BOARD_VIEWS_KEY, JSON.stringify(views))
  for (const listener of [...listeners]) listener()
}

/** How this device shows board `id`: its columns, or the row list. */
export function useBoardView(
  id: string,
  defaultView: DashboardView = "board"
): DashboardView {
  return useSyncExternalStore(
    subscribe,
    () => load()[id] ?? defaultView,
    () => defaultView
  )
}
