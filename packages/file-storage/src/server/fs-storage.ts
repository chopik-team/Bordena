import { createReadStream } from "node:fs"
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import type { Readable } from "node:stream"
import { dispositionFor, resolveType, safeMime } from "./content-type"
import { isValidKey, newKey } from "./key"
import type { FetchedFile, PutResult } from "./s3-storage"

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024

/**
 * Where attachments live (e2e overrides it to a tmp folder)
 */
export const FILES_DIR = "/data/files"

const DIR_OVERRIDE = "FILE_DIR_OVERRIDE"

export interface FsStorageConfig {
  /** Directory the blobs live in. Overridable only so tests can use a tmpdir. */
  dir: string
  /** Upload size cap in bytes (default 25 MiB). */
  maxBytes?: number
}

/**
 * Attachment storage on a local directory
 */
export class FsServerStorage {
  readonly maxBytes: number
  private readonly root: string

  constructor(config: FsStorageConfig) {
    this.root = resolve(config.dir)
    this.maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES
  }

  /**
   * Resolves a key to a path under the root, or null if it isn't one of ours.
   */
  private pathFor(key: string): string | null {
    if (!isValidKey(key)) return null
    const path = resolve(join(this.root, key))
    return path.startsWith(this.root + sep) ? path : null
  }

  async put(
    bytes: Buffer,
    meta: { name: string; mime: string | string[] | undefined }
  ): Promise<PutResult> {
    const mime = safeMime(meta.mime)
    const key = newKey(meta.name)
    const path = join(this.root, key)
    await mkdir(dirname(path), { recursive: true })
    // Write then rename
    const temp = `${path}.tmp`
    await writeFile(temp, bytes)
    await rename(temp, path)
    return { key, mime, size: bytes.length }
  }

  async fetch(key: string): Promise<FetchedFile> {
    const path = this.pathFor(key)
    if (!path) throw new Error("not found")
    const info = await stat(path)
    const contentType = resolveType(key, undefined)
    return {
      body: createReadStream(path) as Readable,
      contentType,
      contentLength: info.size,
      disposition: dispositionFor(contentType),
    }
  }

  async remove(key: string): Promise<void> {
    const path = this.pathFor(key)
    if (!path) return
    await rm(path, { force: true })
  }
}

/**
 * Filesystem storage on FILES_DIR
 */
export function fsStorageFromEnv(
  env: NodeJS.ProcessEnv = process.env
): FsServerStorage {
  return new FsServerStorage({
    dir: env[DIR_OVERRIDE] || FILES_DIR,
    maxBytes: Number(env.FILE_MAX_BYTES) || undefined,
  })
}
