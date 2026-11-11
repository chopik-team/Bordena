import { useSyncExternalStore } from "react"

// Device-only presentation flags; board data and portable preferences stay intact.
const event = "bordena:ui-state"
export function useUiFlag(
  name: string,
  fallback = false
): [boolean, (value: boolean) => void] {
  const key = "bordena:ui:" + name
  const value = useSyncExternalStore(
    (fn) => {
      window.addEventListener(event, fn)
      window.addEventListener("storage", fn)
      return () => {
        window.removeEventListener(event, fn)
        window.removeEventListener("storage", fn)
      }
    },
    () => {
      try {
        const raw = localStorage.getItem(key)
        return raw === null ? fallback : raw === "true"
      } catch {
        return fallback
      }
    }
  )
  return [
    value,
    (next) => {
      localStorage.setItem(key, String(next))
      window.dispatchEvent(new Event(event))
    },
  ]
}
