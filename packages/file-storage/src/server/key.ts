import { randomUUID } from "node:crypto"
import { extname } from "../file-storage"

/** Every attachment key lives under this prefix. */
const PREFIX = "att/"

/** Strict extension for a stored key: a plain lowercase `.xxx` suffix, or "". */
function keySuffix(name: string): string {
  const ext = extname(name)
  // Reject anything path-ish; keep it a plain suffix.
  return /^\.[a-z0-9]+$/.test(ext) ? ext : ""
}

/** A fresh key; `name` only supplies the extension, never the identity. */
export function newKey(name: string): string {
  return `${PREFIX}${randomUUID()}${keySuffix(name)}`
}

/**
 * Whether `key` is one this package could have minted.
 */
export function isValidKey(key: string): boolean {
  return /^att\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(\.[a-z0-9]+)?$/.test(
    key
  )
}
