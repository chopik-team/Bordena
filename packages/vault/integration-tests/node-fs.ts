import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { watch } from "node:fs"
import type { VaultFs } from "../src/column-folder"

/** A missing path is `null`, never a throw: what `tauriFs` does with `exists`. */
async function missing<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work
  } catch {
    return null
  }
}

/** The vault's filesystem on real disk, matching `tauriFs` in the client. */
export function nodeFs(): VaultFs {
  return {
    read: (path) => missing(readFile(path, "utf8")),

    async write(path, content) {
      await writeFile(path, content, "utf8")
    },

    async writeBytes(path, bytes) {
      await writeFile(path, bytes)
    },

    async mkdir(path) {
      await mkdir(path, { recursive: true })
    },

    rename,

    async remove(path) {
      await rm(path, { force: true, recursive: true })
    },

    async readDir(path) {
      const entries = await missing(readdir(path, { withFileTypes: true }))
      if (entries === null) return null
      return entries.filter((e) => !e.isDirectory()).map((e) => e.name)
    },

    async readDirs(path) {
      const entries = await missing(readdir(path, { withFileTypes: true }))
      if (entries === null) return null
      return entries.filter((e) => e.isDirectory()).map((e) => e.name)
    },

    watch(path, listener) {
      const watcher = watch(path, { recursive: true }, () => listener())
      return Promise.resolve(() => watcher.close())
    },
  }
}
