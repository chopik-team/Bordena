import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { realpathSync, watch } from "node:fs"
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
export function nodeFs(): VaultFs & { closeWatchers(): Promise<void> } {
  const closing = new Set<Promise<void>>()
  const stops = new Set<() => void>()
  return {
    async closeWatchers() {
      for (const stop of stops) stop()
      await Promise.all(closing)
    },
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
      // Windows TEMP can contain 8.3 aliases. libuv 1.52.1 can abort on the
      // mismatch between that spelling and long paths in native notifications.
      // Resolve before watching; an error handler cannot catch a native abort.
      const watcher = watch(
        realpathSync.native(path),
        { recursive: true },
        () => listener()
      )
      const stop = () => watcher.close()
      stops.add(stop)
      const closed = new Promise<void>((resolve) => {
        watcher.once("close", () => {
          stops.delete(stop)
          closing.delete(closed)
          resolve()
        })
      })
      closing.add(closed)
      return Promise.resolve(stop)
    },
  }
}
