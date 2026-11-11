import type { SettingsPage } from "@/components/settings/settings-modal"
export function openAppSettings(page: SettingsPage): void {
  window.dispatchEvent(new CustomEvent("bordena:settings", { detail: page }))
}
