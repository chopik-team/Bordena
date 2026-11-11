import { useConnection } from "../api/sync"
import type { Session } from "../api/auth"
import { nameFor, subtitleFor } from "./account-labels"
import { useSession } from "./queries"

export interface Account {
  session: Session | undefined
  name: string
  subtitle: string
  /** Sync is down, so the subtitle names a failure rather than a state. */
  dropped: boolean
  authed: boolean
  /** The first session check hasn't settled */
  pending: boolean
}

/** Who is signed in and what sync is doing, as the sidebar states it. */
export function useAccount(): Account {
  const { data: session, isPending } = useSession()
  const connection = useConnection()

  return {
    session,
    name: nameFor(session, isPending),
    subtitle: subtitleFor(connection),
    dropped: connection.status === "dropped",
    authed: session?.authed === true,
    pending: isPending,
  }
}
