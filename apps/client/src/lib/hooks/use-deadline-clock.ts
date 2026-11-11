import { useSyncExternalStore } from "react"
let now = Date.now(),
  timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!timer)
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((fn) => fn())
    }, 30000)
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}
export function useDeadlineClock(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now
  )
}
