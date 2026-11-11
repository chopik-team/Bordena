import { expect, it } from "vitest"
import { edgeScrollDelta } from "./use-section-autoscroll"
it("scrolls only near valid viewport edges, with bounded speed", () => {
  expect(edgeScrollDelta(0, 0, 1000)).toBe(-16)
  expect(edgeScrollDelta(1000, 0, 1000)).toBe(16)
  expect(edgeScrollDelta(500, 0, 1000)).toBe(0)
  expect(edgeScrollDelta(-1, 0, 1000)).toBe(0)
  expect(edgeScrollDelta(1001, 0, 1000)).toBe(0)
})
