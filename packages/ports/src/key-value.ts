/**
 * Small synchronous string store for settings and session bookkeeping — the
 * server URL, the session token, one-shot "already asked" flags. Synchronous
 * because the callers read it inside `fetch` wrappers and render paths that
 * have nowhere to await; both backings (`localStorage`, expo-sqlite's sync API)
 * can answer that way.
 *
 * Not for records: boards, columns and cards live in {@link ClientDB}.
 *
 * No method throws: a write that can't land is lost, not raised. Callers sit on
 * the sync push path and in render, where nothing above them catches.
 */
export interface KeyValue {
  /** The stored string, or null when the key was never set. */
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}
