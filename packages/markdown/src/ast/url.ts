import { attachmentKeyFromSrc } from "../attachment-src"

const SAFE_PROTOCOL = /^(https?|ircs?|mailto|xmpp)$/i

/**
 * Blanks URLs whose scheme isn't known-safe, leaving relative and fragment
 * URLs alone. Ported from react-markdown's `defaultUrlTransform`, which the web
 * renderer used to get for free — both platforms need it now, and neither can
 * depend on a DOM library to provide it.
 */
export function sanitizeUrl(url: string): string {
  if (/^bordena:\/\/(board|card)\/[a-zA-Z0-9_-]{1,128}$/.test(url)) return url
  const colon = url.indexOf(":")
  if (colon < 0) return url

  // A colon after any of these is part of the path/query/hash, not a scheme.
  for (const char of ["/", "?", "#"]) {
    const index = url.indexOf(char)
    if (index > -1 && colon > index) return url
  }

  return SAFE_PROTOCOL.test(url.slice(0, colon)) ? url : ""
}

const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)+(?=[/?#]|$)/

export function linkUrl(url: string): string {
  const safe = sanitizeUrl(url)
  if (!BARE_DOMAIN.test(safe)) return safe
  return `https://${safe}`
}

export type ImageSource =
  { kind: "attachment"; key: string } | { kind: "url"; url: string }

export function imageSource(url: string | undefined): ImageSource {
  const key = attachmentKeyFromSrc(url)
  if (key !== null) return { kind: "attachment", key }
  return { kind: "url", url: sanitizeUrl(url ?? "") }
}
