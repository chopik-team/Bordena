import type { Net } from "@bordena/ports"

export const webNet: Net = {
  online: () => navigator.onLine,
  subscribe: (listener) => {
    window.addEventListener("online", listener)
    window.addEventListener("offline", listener)
    return () => {
      window.removeEventListener("online", listener)
      window.removeEventListener("offline", listener)
    }
  },
}
