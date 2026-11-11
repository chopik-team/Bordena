import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { licenseNotices } from "./license-notices.ts"
import { readFileSync } from "node:fs"
import { displayVersion } from "../../packages/utils/src/versions.ts"
const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }
const buildVersion = process.env.BORDENA_STAGING === "1" ? process.env.BORDENA_BUILD_VERSION ?? version : version

/** Local development assets for Tauri; no API proxy, PWA or external services. */
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(displayVersion(buildVersion)) },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  plugins: [react(), tailwindcss(), licenseNotices()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  build: { target: "es2022" },
  test: { setupFiles: ["./src/test-setup.ts"] },
})
