import { useEffect, useState } from "react"
import { type Attachment, activeStorage, useConnection } from "@bordena/core"
import { isDesktop } from "@/lib/platform"

const urlCache = new Map<string, string>()
const users = new Map<string, number>(),
  inflight = new Map<string, Promise<string>>()
const MAX_IDLE_URLS = 64
function trimCache(): void {
  const idle = [...urlCache.keys()].filter((key) => !users.get(key))
  for (const key of idle.slice(0, Math.max(0, idle.length - MAX_IDLE_URLS))) {
    URL.revokeObjectURL(urlCache.get(key)!)
    urlCache.delete(key)
  }
}
function retain(key: string): () => void {
  users.set(key, (users.get(key) ?? 0) + 1)
  return () => {
    const count = (users.get(key) ?? 1) - 1
    if (count > 0) users.set(key, count)
    else users.delete(key)
    trimCache()
  }
}
const cacheKey = (cardId: string, key: string) => `${cardId}:${key}`
export function invalidateAttachmentUrl(cardId: string, key: string): void {
  const ck = cacheKey(cardId, key),
    url = urlCache.get(ck)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(ck)
}

function resolve(cardId: string, key: string): Promise<string> {
  const ck = cacheKey(cardId, key),
    cached = urlCache.get(ck)
  if (cached) return Promise.resolve(cached)
  const pending = inflight.get(ck)
  if (pending) return pending
  const result = (
    isDesktop()
      ? activeStorage()
          .get(cardId, key)
          .then((blob) => URL.createObjectURL(blob))
      : activeStorage().url(cardId, key)
  )
    .then((url) => {
      urlCache.set(ck, url)
      trimCache()
      return url
    })
    .finally(() => inflight.delete(ck))
  inflight.set(ck, result)
  return result
}

/**
 * Resolves a viewable URL for an attachment key via the active storage backend
 * (an `/api/files` route). Returns null until resolved or when resolution fails.
 */
export function useAttachmentUrlByKey(
  cardId: string,
  key: string
): string | null {
  const [state, setState] = useState<{ key: string; url: string | null }>({
    key,
    url: null,
  })
  // Resolution can fail on an outage
  const { status } = useConnection()

  useEffect(() => {
    const ck = cacheKey(cardId, key)
    const release = retain(ck)
    if (urlCache.has(ck)) return release

    let alive = true
    resolve(cardId, key)
      .then((u) => {
        urlCache.set(ck, u)
        if (alive) setState({ key, url: u })
      })
      .catch(() => alive && setState({ key, url: null }))

    return () => {
      alive = false
      release()
    }
  }, [cardId, key, status])

  // Cache first so a remount has a URL on the first render; fall back to state,
  // guarded on `key` so a key change doesn't show the previous image.
  return (
    urlCache.get(cacheKey(cardId, key)) ??
    (state.key === key ? state.url : null)
  )
}

export function useAttachmentUrl(
  cardId: string,
  att: Attachment
): string | null {
  return useAttachmentUrlByKey(cardId, att.key)
}

const NO_URLS: Record<string, string> = {}

/**
 * Every attachment URL for one card, keyed by attachment key. The plural form
 * exists so the components that draw attachments can take resolved URLs as
 * props: resolution is async here but synchronous on a public board, and a hook
 * per tile would make that difference the tile's problem.
 */
export function useAttachmentUrls(
  cardId: string,
  attachments: Attachment[]
): Record<string, string> {
  const keys = attachments.map((a) => a.key)
  const signature = keys.join("\0")
  const [, setResolved] = useState(0)
  const { status } = useConnection()

  useEffect(() => {
    let alive = true
    const releases = keys.map((key) => retain(cacheKey(cardId, key)))
    const pending = keys.filter((key) => !urlCache.has(cacheKey(cardId, key)))
    if (!pending.length) return () => releases.forEach((release) => release())

    Promise.all(
      pending.map((key) =>
        resolve(cardId, key)
          .then((url) => urlCache.set(cacheKey(cardId, key), url))
          .catch(() => undefined)
      )
    ).then(() => alive && setResolved((n) => n + 1))

    return () => {
      alive = false
      releases.forEach((release) => release())
    }
    // `signature` stands in for `keys`, which is a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, signature, status])

  if (!keys.length) return NO_URLS

  const urls: Record<string, string> = {}
  for (const key of keys) {
    const url = urlCache.get(cacheKey(cardId, key))
    if (url) urls[key] = url
  }
  return urls
}
