import { t } from "@bordena/i18n"
import type { Http } from "@bordena/ports"
export const webHttp: Http = {
  // On desktop this routes through Tauri's HTTP plugin, so the request runs in
  // Rust and bypasses the webview's CORS.
  fetch: async () => {
    throw new Error(t("Сетевые интеграции отключены в Bordena 0.1"))
  },
  url: (path) => `https://offline.invalid${path}`,
  isConfigured: () => false,
  subscribe: () => () => {},
}
