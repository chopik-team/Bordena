import type { Connection } from "../api/sync"

type Status = Connection["status"]

/** Where a file's URL comes from: the reader's own sync session, or a share token. */
export type AttachmentSource = "sync" | "token"

const UNREACHABLE = {
  offline: "You're offline. Files are stored on the server.",
  auth: "Signed out on the server. Sign in to see files.",
  server: "Can't reach the server. Files are stored there.",
  forbidden: "No access to this file.",
} as const

/**
 * Why an attachment didn't load
 */
export function attachmentUnavailable(
  connection: Connection,
  source: AttachmentSource = "sync"
): string {
  if (source === "token") return "File unavailable."
  if (connection.status === "dropped") return UNREACHABLE[connection.reason]
  if (connection.status === "local") return "Sign in to see files."
  return "File unavailable."
}

/**
 * Whether to draw the unavailable placeholder instead of the image
 */
export function imageUnavailable({
  source,
  hasUrl,
  failedAt,
  status,
}: {
  source: AttachmentSource
  hasUrl: boolean
  failedAt: Status | null
  status: Status
}): boolean {
  if (source === "token") return failedAt !== null
  // Sync was healthy when it failed, so the object itself is gone.
  if (failedAt === "ok") return true
  // It failed during an outage; once sync is back the image is worth another go.
  if (failedAt !== null) return status !== "ok"
  // Never resolved, and resolving it needs the server.
  return !hasUrl && status !== "ok"
}
