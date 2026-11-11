/**
 * Generic text ranking over items with named fields
 */

/** A field's name decides its weight; see WEIGHTS. `number` holds digits only. */
export type Fields = Partial<Record<"number" | "title" | "body", string>>

export interface Segment {
  text: string
  hit: boolean
}

export interface Ranked<T> {
  item: T
  score: number
}

interface Tiers {
  exact?: number
  prefix?: number
  contains?: number
}

/**
 * Score per field, per how well the term lands on it.
 */
const WEIGHTS: Record<keyof Fields, Tiers> = {
  number: { exact: 1000, prefix: 100 },
  title: { prefix: 50, contains: 30 },
  body: { contains: 10 },
}

const FIELDS = Object.keys(WEIGHTS) as (keyof Fields)[]

/**
 * The only field-specific rule in this file: a card id is digits, so a term
 * still carrying an old board prefix ("road-12", "ROAD12") matches on its tail.
 */
function numberTerm(term: string): string | null {
  // A prefix could hold digits of its own ("UB5-12"), so cut at the dash rather
  // than at the letters; without a dash, only leading letters can be prefix.
  const dash = term.indexOf("-")
  const tail = dash === -1 ? term.replace(/^[a-z]+/, "") : term.slice(dash + 1)
  return /^\d+$/.test(tail) ? tail : null
}

export function queryTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function scoreField(field: keyof Fields, value: string, term: string): number {
  const tiers = WEIGHTS[field]
  const text = value.toLowerCase()
  const needle = field === "number" ? numberTerm(term) : term
  if (!needle || !text) return 0

  if (tiers.exact != null && text === needle) return tiers.exact
  if (tiers.prefix != null && text.startsWith(needle)) return tiers.prefix
  if (tiers.contains != null && text.includes(needle)) return tiers.contains
  return 0
}

/** The best any field does on this term; 0 when the term matches nothing. */
function scoreTerm(fields: Fields, term: string): number {
  let best = 0
  for (const field of FIELDS) {
    const value = fields[field]
    if (value == null) continue
    best = Math.max(best, scoreField(field, value, term))
  }
  return best
}

/**
 * Items matching **every** term, best first. Equal scores keep input order, so
 * a caller wanting a meaningful tie-break feeds its items in that order. An
 * empty query returns everything unchanged.
 */
export function rankBy<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Fields
): Ranked<T>[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return items.map((item) => ({ item, score: 0 }))

  const ranked: Ranked<T>[] = []
  for (const item of items) {
    const fields = getFields(item)
    let score = 0
    for (const term of terms) {
      const termScore = scoreTerm(fields, term)
      if (termScore === 0) {
        score = 0
        break
      }
      score += termScore
    }
    if (score > 0) ranked.push({ item, score })
  }
  return ranked.sort((a, b) => b.score - a.score)
}

/** The earliest term hit at or after `from`, as `[index, length]`. */
function nextHit(
  text: string,
  terms: string[],
  from: number
): [number, number] {
  let at = -1
  let length = 0
  for (const term of terms) {
    const found = text.indexOf(term, from)
    if (found === -1) continue
    if (at === -1 || found < at || (found === at && term.length > length)) {
      at = found
      length = term.length
    }
  }
  return [at, length]
}

/**
 * `text` split into non-overlapping matched / unmatched runs for `<mark>`
 * rendering. Concatenating the segments reproduces `text` exactly.
 */
export function segment(text: string, terms: string[]): Segment[] {
  const haystack = text.toLowerCase()
  const segments: Segment[] = []
  let at = 0

  while (at < text.length) {
    const [found, length] = nextHit(haystack, terms, at)
    if (found === -1) break
    if (found > at) segments.push({ text: text.slice(at, found), hit: false })
    segments.push({ text: text.slice(found, found + length), hit: true })
    at = found + length
  }
  if (at < text.length) segments.push({ text: text.slice(at), hit: false })
  return segments
}
