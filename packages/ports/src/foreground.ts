/**
 * Whether the user is looking at the app right now. Background sync polls only
 * while it is, so a backgrounded app stops burning battery and network on a
 * board nobody is reading.
 *
 * "Active" is deliberately coarse: a browser tab that is visible but behind
 * another window still counts, because the board on screen is still stale to a
 * user who glances at it.
 */
export interface Foreground {
  active(): boolean

  /** Fires on every transition, and on a re-focus that didn't change
   * {@link active}; returns an unsubscribe. */
  subscribe(listener: () => void): () => void
}
