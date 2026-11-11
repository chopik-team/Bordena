import { type PublicBoard } from "@bordena/contract"
import { rawFetch } from "./fetch"
import { apiUrl } from "./server"

/**
 * Reading a board through its public link.
 *
 * Deliberately `rawFetch`, not `appFetch`: a public board carries no session,
 * and sending one would hide the day this stops working without credentials.
 *
 * This is a snapshot, not a sync channel. Nothing here writes to IndexedDB, so
 * an anonymous visitor never acquires a dirty queue and never collides with the
 * user-switch wipe.
 */

/** Thrown for a token that resolves to nothing: unknown, revoked, or deleted. */
export class PublicBoardNotFound extends Error {
  constructor() {
    super("This link is no longer available.")
    this.name = "PublicBoardNotFound"
  }
}

const basePath = (token: string) => `/api/public/b/${encodeURIComponent(token)}`

export async function fetchPublicBoard(token: string): Promise<PublicBoard> {
  const res = await rawFetch(apiUrl(basePath(token)))
  if (res.status === 404) throw new PublicBoardNotFound()
  if (!res.ok) throw new Error(`Could not load this board (${res.status}).`)
  return (await res.json()) as PublicBoard
}

/** Where an attachment of a public board's card is readable from. The ordinary
 * `/api/files` route is behind the session check, so it is no use here. */
export function publicAttachmentUrl(token: string, key: string): string {
  return apiUrl(`${basePath(token)}/files/${encodeURIComponent(key)}`)
}
