import { validDeadline } from "@bordena/contract"

/** Portable Markdown fragment, never an external protocol or a second database. */
export function parseInlineDate(
  value: string
): { id: string; value: string } | null {
  const match =
    /^#bordena-date=([^&\s]{1,128})&id=([a-zA-Z0-9_-]{1,128})$/.exec(value)
  if (!match) return null
  try {
    const date = decodeURIComponent(match[1])
    return validDeadline(date) ? { id: match[2], value: date } : null
  } catch {
    return null
  }
}
export function inlineDateUrl(value: string, id: string): string {
  const url = `#bordena-date=${encodeURIComponent(value)}&id=${id}`
  if (!parseInlineDate(url)) throw new Error("Invalid inline date")
  return url
}
/** Match one unique anchor only. Duplicate IDs or a newer anchor are explicit conflicts. */
export function replaceInlineDate(
  body: string,
  originalUrl: string,
  value: string | null
): string {
  const original = parseInlineDate(originalUrl)
  if (!original) throw new Error("Invalid inline date")
  const matches = [
    ...body.matchAll(/\[((?:\\.|[^\\\]])*)\]\((#bordena-date=[^\s)]+)\)/g),
  ].filter((match) => parseInlineDate(match[2])?.id === original.id)
  if (matches.length !== 1 || matches[0][2] !== originalUrl)
    throw new Error("Text date changed; reopen the calendar")
  const match = matches[0],
    next =
      value === null
        ? match[1]
        : `[${match[1]}](${inlineDateUrl(value, original.id)})`
  return (
    body.slice(0, match.index) +
    next +
    body.slice(match.index! + match[0].length)
  )
}
