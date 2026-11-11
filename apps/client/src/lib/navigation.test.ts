import { describe, expect, it } from "vitest"
import {
  readNavigation,
  visitBoard,
  closeBoardTab,
  nextBoardTab,
} from "./navigation"

describe("persistent board navigation", () => {
  it("recovers from invalid preferences and filters duplicate IDs", () => {
    expect(readNavigation("bad").tabs).toEqual([])
    expect(
      readNavigation('{"tabs":["a","a",4],"favorites":["b"],"active":"a"}')
    ).toMatchObject({ tabs: ["a"], favorites: ["b"], active: "a" })
  })
  it("visits without duplicating tabs, remembers recent ordering across serialization", () => {
    let s = readNavigation(null)
    for (const id of ["a", "b", "a"]) s = visitBoard(s, id)
    expect(readNavigation(JSON.stringify(s))).toEqual({
      tabs: ["a", "b"],
      recent: ["a", "b"],
      active: "a",
      favorites: [],
    })
    expect(visitBoard(s, "a")).toBe(s)
  })
  it("closes only a tab, selects the nearest remaining tab and preserves favorites/history", () => {
    const s = {
      ...visitBoard(visitBoard(readNavigation(null), "a"), "b"),
      favorites: ["b"],
    }
    const closed = closeBoardTab(s, "b")
    expect(closed).toEqual({
      tabs: ["a"],
      favorites: ["b"],
      recent: ["b", "a"],
      active: "a",
    })
    expect(closeBoardTab(closed, "a").active).toBeNull()
  })
  it("cycles in both directions and handles no tabs", () => {
    const s = visitBoard(visitBoard(readNavigation(null), "a"), "b")
    expect(nextBoardTab(s, false)).toBe("a")
    expect(nextBoardTab(s, true)).toBe("a")
    expect(nextBoardTab(readNavigation(null), false)).toBeNull()
  })
})
