import type { VaultFs } from "@bordena/vault"

const DEBOUNCE_MS = 400

/**
 * The vault's filesystem on the desktop.
 */
export const tauriFs: VaultFs = {
  async read(path) {
    const { exists, readTextFile } = await import("@tauri-apps/plugin-fs")
    if (!(await exists(path))) return null
    return readTextFile(path)
  },

  async write(path, content) {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs")
    await writeTextFile(path, content)
  },

  async writeBytes(path, bytes) {
    const { writeFile } = await import("@tauri-apps/plugin-fs")
    await writeFile(path, bytes)
  },

  async mkdir(path) {
    const { mkdir } = await import("@tauri-apps/plugin-fs")
    await mkdir(path, { recursive: true })
  },

  async rename(from, to) {
    const { rename } = await import("@tauri-apps/plugin-fs")
    await rename(from, to)
  },

  async remove(path) {
    const { exists, remove } = await import("@tauri-apps/plugin-fs")
    if (await exists(path)) await remove(path)
  },

  async readDir(path) {
    const { exists, readDir } = await import("@tauri-apps/plugin-fs")
    if (!(await exists(path))) return null
    const entries = await readDir(path)
    return entries.filter((e) => !e.isDirectory).map((e) => e.name)
  },

  async readDirs(path) {
    const { exists, readDir } = await import("@tauri-apps/plugin-fs")
    if (!(await exists(path))) return null
    const entries = await readDir(path)
    return entries.filter((e) => e.isDirectory).map((e) => e.name)
  },

  async watch(path, listener) {
    const { watch } = await import("@tauri-apps/plugin-fs")
    return watch(path, () => listener(), {
      recursive: true,
      delayMs: DEBOUNCE_MS,
    })
  },
}
