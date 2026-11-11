// The session rides in a cookie on web. The desktop webview has no usable
// cookie jar, so the token the server echoes back on `set-auth-token` is kept
// here and sent as a bearer from then on.

import type { Auth } from "@bordena/ports"
import { isDesktop } from "@/lib/platform"
import { webKeyValue } from "./web-kv"

const TOKEN_KEY = "bordena:session-token"

export const webAuth: Auth = {
  token: () => (isDesktop() ? webKeyValue.get(TOKEN_KEY) : null),
  capture: (token) => {
    if (isDesktop()) webKeyValue.set(TOKEN_KEY, token)
  },
  clear: () => webKeyValue.remove(TOKEN_KEY),
}
