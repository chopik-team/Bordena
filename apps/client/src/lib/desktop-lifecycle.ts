import { t } from "@bordena/i18n"
import { flushCardEdits, reportError } from "@bordena/core"
import { isDesktop } from "./platform"
import { flushLinkedSync } from "./linked-sync"
export async function installDesktopLifecycle(): Promise<void> {
  if (!isDesktop()) return
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  const { invoke } = await import("@tauri-apps/api/core")
  const win = getCurrentWindow()
  if (win.label !== "main") return
  let closing = false
  const finishClose = async () => {
    if (closing) return
    closing = true
    try {
      await flushCardEdits()
      await flushLinkedSync()
      await invoke("quit_app")
    } catch (error) {
      closing = false
      reportError(
        new Error(
          t("Не удалось сохранить изменения. Bordena остаётся открытой")
        )
      )
      console.error(
        "Bordena close failed",
        error instanceof Error ? error.name : "StorageError"
      )
    }
  }
  await win.onCloseRequested((event) => {
    event.preventDefault()
    if (closing) return
    const request = new CustomEvent("bordena:before-close", {
      cancelable: true,
      detail: { resume: finishClose },
    })
    if (window.dispatchEvent(request)) void finishClose()
  })
}
