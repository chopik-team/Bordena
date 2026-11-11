import { t } from "@bordena/i18n"
import { isDesktop } from "../platform"
import { MAX_ARCHIVE_BYTES } from "./format"
export async function saveExchange(
  bytes: Uint8Array,
  extension: "json" | "zip",
  label = "workspace"
): Promise<boolean> {
  if (!isDesktop())
    throw new Error(t("Экспорт доступен в локальном приложении Bordena"))
  const { save } = await import("@tauri-apps/plugin-dialog")
  const { writeFile, readFile } = await import("@tauri-apps/plugin-fs")
  const name = `Bordena-${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`
  const path = await save({
    defaultPath: name,
    filters: [{ name: "Bordena", extensions: [extension] }],
  })
  if (!path) return false
  await writeFile(path, bytes)
  const written = await readFile(path)
  const { sha256 } = await import("./format")
  if ((await sha256(written)) !== (await sha256(bytes)))
    throw new Error(t("Файл не прошёл проверку после записи"))
  return true
}
export async function pickExchange(): Promise<Uint8Array | null> {
  const { open } = await import("@tauri-apps/plugin-dialog")
  const { readFile, stat } = await import("@tauri-apps/plugin-fs")
  const path = await open({
    multiple: false,
    filters: [{ name: "Bordena JSON / ZIP", extensions: ["json", "zip"] }],
  })
  if (!path || typeof path !== "string") return null
  if ((await stat(path)).size > MAX_ARCHIVE_BYTES)
    throw new Error(t("Файл превышает 128 МиБ"))
  return readFile(path)
}
