// Side-effect module: installs the web ports. Import it first in the entry
// point — `@bordena/core`'s sync facade is a module-scope singleton that reaches
// for the runtime as it is constructed, so the ports have to be in place before
// any module that touches core is evaluated, not merely before `main` runs.

import { flushSync } from "react-dom"
import { installRuntime, type Runtime } from "@bordena/core"
import { webAuth } from "./web-auth"
import { webDb } from "./web-db"
import { webForeground } from "./web-foreground"
import { webHttp } from "./web-http"
import { webKeyValue } from "./web-kv"
import { webNet } from "./web-net"
import { localFiles } from "./local-files"

/** The browser's ports — the same set in the Tauri webview, which is a browser. */
const webRuntime: Runtime = {
  db: webDb,
  kv: webKeyValue,
  http: webHttp,
  auth: webAuth,
  net: webNet,
  foreground: webForeground,
  files: localFiles,
  flushSync,
}

installRuntime(webRuntime)
