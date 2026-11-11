import type { Foreground } from "@bordena/ports"

export const webForeground: Foreground = {
  active: () => document.visibilityState === "visible",
  subscribe: (listener) => {
    // `focus` as well as `visibilitychange`: alt-tabbing back from another app
    // leaves the tab "visible" throughout, so only `focus` reports the return.
    document.addEventListener("visibilitychange", listener)
    window.addEventListener("focus", listener)
    return () => {
      document.removeEventListener("visibilitychange", listener)
      window.removeEventListener("focus", listener)
    }
  },
}
