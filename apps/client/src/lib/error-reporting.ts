import { createElement } from "react"
import { toast } from "react-hot-toast"
import {
  isNetworkError,
  isOfflineAcknowledged,
  isUnauthorized,
  reportError,
  setErrorReporter,
} from "@bordena/core"
import { ErrorToast } from "@/components/toasts/error/error-toast"
import { formatLocalError } from "./local-error"

// One id for every failure
const TOAST_ID = "error"

/**
 * Failures outside a render
 */
export function initErrorReporting(): void {
  setErrorReporter((error) => {
    console.error(
      "Bordena operation failed",
      error instanceof Error ? error.name : "UnknownError"
    )
    if (isOfflineAcknowledged() && isNetworkError(error)) return
    if (isUnauthorized(error)) return
    toast.custom(
      (toastInstance) =>
        createElement(ErrorToast, {
          visible: toastInstance.visible,
          message: formatLocalError(error),
        }),
      { id: TOAST_ID }
    )
  })

  window.addEventListener("unhandledrejection", (event) =>
    reportError(event.reason)
  )

  window.addEventListener("error", (event) =>
    reportError(event.error ?? event.message)
  )
}
