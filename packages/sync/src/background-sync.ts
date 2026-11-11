import type { Foreground, Net } from "@bordena/ports"

/**
 * Starts a periodic background sync, polling only while the app is in front of
 * the user.
 *
 * {@link Foreground.subscribe} may fire without a transition; `reconcile` is
 * idempotent (the engine guards overlapping runs), so adapters are free to be
 * generous about what counts as coming back.
 *
 * `paused` skips the poll and the foreground sync; coming back online still
 * syncs, since that is how a paused session recovers.
 */
export function startBackgroundSync(
  reconcile: () => void,
  intervalMs: number,
  {
    foreground,
    net,
    paused,
  }: { foreground: Foreground; net: Net; paused: () => boolean }
): () => void {
  const tick = () => {
    if (!paused()) reconcile()
  }

  let id: ReturnType<typeof setInterval> | undefined

  const start = () => {
    if (id === undefined) id = setInterval(tick, intervalMs)
  }

  const stop = () => {
    if (id !== undefined) {
      clearInterval(id)
      id = undefined
    }
  }

  const onForeground = () => {
    if (foreground.active()) {
      tick()
      start()
    } else {
      stop()
    }
  }

  // Coming back online: flush the queue now rather than making the user watch a
  // stale "offline" notice until the next tick. Worth doing while backgrounded
  // too, where the poll is stopped and nothing else would.
  const onNet = () => {
    if (net.online()) reconcile()
  }

  const unsubscribeForeground = foreground.subscribe(onForeground)
  const unsubscribeNet = net.subscribe(onNet)
  onForeground()

  return () => {
    unsubscribeForeground()
    unsubscribeNet()
    stop()
  }
}
