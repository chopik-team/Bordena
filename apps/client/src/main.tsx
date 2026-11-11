import "@/lib/adapters/install" // must stay first
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { setLanguage } from "@bordena/i18n"
import { preferencesSnapshot } from "@/lib/preferences"
import { Toaster } from "react-hot-toast"
import { ThemeProvider } from "@/providers/theme/theme-provider"
import { AppSettings } from "@/components/app-settings"
import { isDesktop } from "@/lib/platform"
import { bootstrapClient, queryClient } from "@bordena/core"
import { trackAppHeight } from "@/lib/app-height"
import { blockEdgeSwipeNavigation } from "@/lib/edge-swipe"
import { initErrorReporting } from "@/lib/error-reporting"
import { initExternalLinks } from "@/lib/external-links"
import { initZoom } from "@/lib/zoom"
import { requestPersistentStorage } from "@/lib/persist"
import { Router } from "./router.tsx"
import { ErrorBoundary } from "@/components/error-boundary"
import { UndoToaster } from "@/components/toasts/card-delete/undo-toaster"
import { WindowDragRegion } from "@/components/window-drag-region"
import { WindowControlsFlag } from "@/components/window-controls-flag"
import { WindowSyncListener } from "@/components/card-window/window-sync-listener"
import "./index.css"
import { initializeWorkspace } from "@/lib/initialize"
import { webDb } from "@/lib/adapters/web-db"
import { installDesktopLifecycle } from "@/lib/desktop-lifecycle"
import { installLinkedSync } from "@/lib/linked-sync"
import { installStructuralHistory } from "@/lib/structural-history"
import { installDeadlineNotifications } from "@/lib/deadline-notifications"
import { reportError } from "@bordena/core"

const root = createRoot(document.getElementById("root")!)
setLanguage(preferencesSnapshot().language)
window.addEventListener("languagechange", () =>
  setLanguage(preferencesSnapshot().language)
)

trackAppHeight()

initErrorReporting()

{
  try {
    await webDb.bindEpoch()
    await bootstrapClient(undefined, initializeWorkspace)
  } catch (error) {
    console.error("Bootstrap failed", error)
    root.render(
      <StrictMode>
        <ErrorBoundary
          error={error instanceof Error ? error : new Error(String(error))}
        >
          {null}
        </ErrorBoundary>
      </StrictMode>
    )
    throw error
  }

  blockEdgeSwipeNavigation()

  initZoom()

  initExternalLinks()
  await installDesktopLifecycle()
  const ownsAutomation =
    !isDesktop() ||
    (await import("@tauri-apps/api/window")).getCurrentWindow().label === "main"
  installLinkedSync(ownsAutomation)
  installStructuralHistory()
  await installDeadlineNotifications()
  window.addEventListener("bordena:automation-error", (event) =>
    reportError(new Error((event as CustomEvent<string>).detail))
  )

  if (!isDesktop()) void requestPersistentStorage()

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Router />
            <AppSettings />
            <Toaster position="bottom-center" gutter={8} reverseOrder={false} />
            <UndoToaster />
            <WindowDragRegion />
            <WindowControlsFlag />
            <WindowSyncListener />
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}
