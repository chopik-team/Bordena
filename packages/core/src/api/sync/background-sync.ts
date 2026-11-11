import { startBackgroundSync as start } from "@bordena/sync"
import { runtime } from "../../runtime"
import { isOfflineAcknowledged } from "./connection"
import { sync } from "./sync-engine"

const DEFAULT_SYNC_INTERVAL = 3_000

/**
 * Starts the periodic background sync at the deck cadence. Returns a stop
 * function that clears the timer and listener.
 *
 * `intervalMs` is how the e2e bundle ticks fast (sub-second) and observes a
 * remote change without waiting out the production cadence — the host reads it
 * from its own build config. Anything unset or invalid falls back to the default.
 */
export function startBackgroundSync(intervalMs?: number): () => void {
  const ms =
    intervalMs !== undefined && Number.isFinite(intervalMs) && intervalMs > 0
      ? intervalMs
      : DEFAULT_SYNC_INTERVAL
  const { foreground, net } = runtime()
  return start(() => void sync.reconcile(), ms, {
    foreground,
    net,
    paused: () => !net.online() || isOfflineAcknowledged(),
  })
}
