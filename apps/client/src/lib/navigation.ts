import { useSyncExternalStore } from "react"

const KEY = "bordena:navigation:v1"
export interface NavigationState {
  tabs: string[]
  favorites: string[]
  recent: string[]
  active: string | null
}
const empty = (): NavigationState => ({
  tabs: [],
  favorites: [],
  recent: [],
  active: null,
})
export function readNavigation(raw: string | null): NavigationState {
  try {
    const value = JSON.parse(raw ?? "null")
    const list = (v: unknown) =>
      Array.isArray(v)
        ? [
            ...new Set(
              v.filter(
                (x): x is string => typeof x === "string" && x.length <= 128
              )
            ),
          ].slice(0, 1000)
        : []
    return {
      tabs: list(value?.tabs),
      favorites: list(value?.favorites),
      recent: list(value?.recent).slice(0, 10),
      active: typeof value?.active === "string" ? value.active : null,
    }
  } catch {
    return empty()
  }
}
export function visitBoard(
  state: NavigationState,
  id: string
): NavigationState {
  if (state.active === id && state.tabs.includes(id) && state.recent[0] === id)
    return state
  return {
    ...state,
    tabs: state.tabs.includes(id) ? state.tabs : [...state.tabs, id],
    active: id,
    recent: [id, ...state.recent.filter((x) => x !== id)].slice(0, 10),
  }
}
export function closeBoardTab(
  state: NavigationState,
  id: string
): NavigationState {
  const at = state.tabs.indexOf(id),
    tabs = state.tabs.filter((x) => x !== id)
  return {
    ...state,
    tabs,
    active:
      state.active === id
        ? (tabs[Math.min(at, tabs.length - 1)] ?? null)
        : state.active,
  }
}
export function nextBoardTab(
  state: NavigationState,
  backwards: boolean
): string | null {
  if (!state.tabs.length) return null
  return state.tabs[
    (Math.max(0, state.tabs.indexOf(state.active ?? "")) +
      (backwards ? -1 : 1) +
      state.tabs.length) %
      state.tabs.length
  ]
}
let current: NavigationState | undefined
const listeners = new Set<() => void>()
export function navigationSnapshot(): NavigationState {
  if (!current) {
    try {
      current = readNavigation(localStorage.getItem(KEY))
    } catch {
      current = empty()
    }
  }
  return current
}
export function changeNavigation(
  update: (state: NavigationState) => NavigationState
) {
  const next = update(navigationSnapshot())
  if (next === current) return
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* Preferences remain usable during the session. */
  }
  listeners.forEach((fn) => fn())
}
export function useNavigation() {
  return useSyncExternalStore((fn) => {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, navigationSnapshot)
}
export function toggleFavorite(id: string) {
  changeNavigation((s) => ({
    ...s,
    favorites: s.favorites.includes(id)
      ? s.favorites.filter((x) => x !== id)
      : [...s.favorites, id],
  }))
}
