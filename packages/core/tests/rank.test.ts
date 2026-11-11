import { describe, expect, it } from "vitest"
import { rankBy, segment, type Fields } from "../src/search"

interface Item extends Fields {
  id: string
}

const rank = (items: Item[], query: string) =>
  rankBy(items, query, ({ number, title, body }) => ({ number, title, body }))

const ids = (items: Item[], query: string) =>
  rank(items, query).map(({ item }) => item.id)

describe("rankBy", () => {
  it("orders title-prefix above title-contains above body", () => {
    const items: Item[] = [
      { id: "body", title: "nothing", body: "a sync bug" },
      { id: "contains", title: "the sync bug" },
      { id: "prefix", title: "sync the bug" },
    ]

    expect(ids(items, "sync")).toEqual(["prefix", "contains", "body"])
  })

  it("never matches an absent field", () => {
    const items: Item[] = [{ id: "a", title: "sync", body: "sync" }]

    // The wikilink picker leaves `body` off to get title-and-number matching.
    expect(rankBy(items, "sync", ({ title }) => ({ title }))).toHaveLength(1)
    expect(rankBy(items, "sync", () => ({}))).toEqual([])
  })

  it("drops an item matching only one of the terms", () => {
    const items: Item[] = [
      { id: "both", title: "sync bug" },
      { id: "one", title: "sync only" },
    ]

    expect(ids(items, "sync bug")).toEqual(["both"])
  })

  it("keeps input order for equal scores and for an empty query", () => {
    const items: Item[] = [
      { id: "second", title: "sync b" },
      { id: "first", title: "sync a" },
    ]

    expect(ids(items, "sync")).toEqual(["second", "first"])
    expect(ids(items, "  ")).toEqual(["second", "first"])
  })

  describe("the number field", () => {
    const items: Item[] = [{ id: "12", number: "12" }]

    it("scores an old prefixed id the same as the bare digits", () => {
      const bare = rank(items, "12")
      expect(rank(items, "road-12")).toEqual(bare)
      expect(rank(items, "ROAD-12")).toEqual(bare)
      // A prefix could carry digits of its own, from a name like "UB5".
      expect(rank(items, "UB5-12")).toEqual(bare)
    })

    it("puts a partial number below an exact one", () => {
      const [exact] = rank(items, "12")
      const [partial] = rank(items, "1")

      expect(partial.score).toBeLessThan(exact.score)
      expect(rank(items, "3")).toEqual([])
    })

    it("ignores a term left with no digits, but still matches a title", () => {
      const titled: Item[] = [{ id: "a", number: "12", title: "road-map" }]

      expect(rank(items, "road")).toEqual([])
      expect(ids(titled, "road-")).toEqual(["a"])
    })
  })
})

describe("segment", () => {
  it("reproduces the input exactly", () => {
    // These runs are rendered as <mark>s over the same string; a dropped or
    // duplicated character rewrites the text the user is reading.
    const text = "A sync bug, syncing SYNC and nothing else."
    const joined = segment(text, ["sync", "bug"])
      .map(({ text: run }) => run)
      .join("")

    expect(joined).toBe(text)
  })

  it("marks case-insensitive runs without overlapping them", () => {
    expect(segment("Sync bug", ["sync"])).toEqual([
      { text: "Sync", hit: true },
      { text: " bug", hit: false },
    ])
    expect(segment("syncing", ["sync", "syncing"])).toEqual([
      { text: "syncing", hit: true },
    ])
  })
})
