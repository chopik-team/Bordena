import { lazy, Suspense, useEffect, useState } from "react"
import { useT } from "@bordena/i18n"
import type { SettingsPage } from "./settings/settings-modal"
const SettingsModal = lazy(() =>
  import("./settings/settings-modal").then((module) => ({
    default: module.SettingsModal,
  }))
)

/** Stable window-level host: responsive sidebar changes must not close global dialogs. */
export function AppSettings() {
  const [page, setPage] = useState<SettingsPage | null>(null),
    t = useT()
  useEffect(() => {
    const open = (event: Event) => {
      const value = (event as CustomEvent<SettingsPage>).detail
      if (
        ["interface", "boards", "data", "about", "guide", "changes"].includes(
          value
        )
      )
        setPage(value)
    }
    window.addEventListener("bordena:settings", open)
    return () => window.removeEventListener("bordena:settings", open)
  }, [])
  return (
    page && (
      <Suspense
        fallback={
          <p role="status" className="fixed right-4 bottom-4 text-xs">
            {t("Загрузка…")}
          </p>
        }
      >
        <SettingsModal
          key={page}
          open
          initialPage={page}
          onOpenChange={(value) => {
            if (!value) setPage(null)
          }}
        />
      </Suspense>
    )
  )
}
