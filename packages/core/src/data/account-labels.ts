import type { Connection } from "../api/sync"
import type { Session } from "../api/auth"

const DROPPED = {
  offline: "Offline",
  auth: "Signed out on the server",
  server: "No server",
  forbidden: "No access",
} as const

export function nameFor(
  session: Session | undefined,
  pending: boolean
): string {
  if (pending) return "…"
  if (!session?.authed) return "Not signed in"
  return session.login ?? "Signed in"
}

export function subtitleFor(connection: Connection): string {
  if (connection.status === "ok") return "Syncing"
  if (connection.status === "local") return "Sign in to sync"
  return DROPPED[connection.reason]
}
