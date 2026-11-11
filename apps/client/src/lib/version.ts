import { useEffect, useState } from "react"
import { isDesktop } from "./platform"

// package.json supplies both Tauri and the build-time label. Hide a zero patch
// in the UI (0.6.0 → 0.6), keeping nonzero patches visible (0.6.1).
export function useAppVersion(): string {
  const [version, setVersion] = useState(__APP_VERSION__)

  useEffect(() => {
    if (!isDesktop()) return
    let active = true
    void import("@tauri-apps/api/app").then(async ({ getVersion }) => {
      const v = await getVersion()
      if (active) setVersion(v.replace(/\.0$/, ""))
    })
    return () => {
      active = false
    }
  }, [])

  return version
}
