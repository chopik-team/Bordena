/**
 * How a request proves who it is. Web rides the cookie better-auth sets on
 * sign-in, so there is nothing to carry and {@link token} is always null;
 * platforms with no usable cookie jar keep the token the server echoes back on
 * the `set-auth-token` header and send it as a bearer.
 */
export interface Auth {
  /** The bearer token to attach, or null where a cookie carries the session. */
  token(): string | null

  /**
   * Offers the token from a sign-in response. Implementations that use cookies
   * ignore it, so callers never have to ask which kind they are on.
   */
  capture(token: string): void

  /** Forgets the stored token. A no-op where nothing was stored. */
  clear(): void
}
