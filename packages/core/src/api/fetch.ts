import { errorMessage } from "../report-error"
import { runtime } from "../runtime"

/** The request got no response at all: offline, DNS, refused connection. */
export class NetworkError extends TypeError {
  constructor(cause: unknown) {
    super(errorMessage(cause), { cause })
    this.name = "NetworkError"
  }
}

export function isNetworkError(error: unknown): boolean {
  let current = error
  while (current instanceof Error) {
    if (current instanceof NetworkError) return true
    current = current.cause
  }
  return false
}

/**
 * `fetch` with no session attached — the platform's raw transport.
 *
 * This is what better-auth's own client is built on — see `auth-client`.
 */
export const rawFetch: typeof fetch = async (input, init) => {
  try {
    return await runtime().http.fetch(input, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error
    throw new NetworkError(error)
  }
}

/** `fetch` carrying the session: a cookie, or a bearer token where there is one. */
export const appFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  )
  const token = runtime().auth.token()
  if (token) headers.set("authorization", `Bearer ${token}`)

  return rawFetch(input, { ...init, credentials: "include", headers })
}
