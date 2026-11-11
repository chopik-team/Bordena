/**
 * Where the server is and how bytes reach it. Two platform differences hide
 * behind this: the transport (a webview's `fetch` can't always be used — the
 * desktop app routes through Tauri's Rust HTTP plugin to bypass CORS) and the
 * base URL (same-origin on web, a URL the user configures anywhere else).
 */
export interface Http {
  /**
   * The transport, with no session attached. `Auth` is what adds credentials;
   * the auth client builds on this one directly, since it is what obtains them.
   */
  fetch: typeof fetch

  /** Absolute URL for an app-relative path (`/api/version`). */
  url(path: string): string

  /**
   * Whether a server is known. False only where the base URL has to be
   * configured and has not been — same-origin platforms are always configured,
   * and the app runs purely local until this turns true.
   */
  isConfigured(): boolean

  /** Fires when the base URL changes; returns an unsubscribe. */
  subscribe(listener: () => void): () => void
}
