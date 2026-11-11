import { describe, it, expect } from "vitest"
import { parseLocalLink } from "./local-links"
import { sanitizeUrl } from "@bordena/markdown"
describe("safe local routes", () => {
  it("recognizes stable board and card IDs", () => {
    expect(parseLocalLink("bordena://board/FIFA-23")).toEqual({
      kind: "board",
      id: "FIFA-23",
    })
    expect(parseLocalLink("bordena://card/card_1")).toEqual({
      kind: "card",
      id: "card_1",
    })
    expect(sanitizeUrl("bordena://board/FIFA-23")).toBe(
      "bordena://board/FIFA-23"
    )
  })
  it("rejects other schemes, encoded paths, traversal and command-like suffixes", () => {
    for (const value of [
      "javascript:alert(1)",
      "file:///C:/x.exe",
      "powershell:run",
      "bordena://board/../bad",
      "bordena://board/a?exec=1",
      "bordena://card/%2e%2e",
      "bordena://shell/run",
    ]) {
      expect(parseLocalLink(value)).toBeNull()
      expect(sanitizeUrl(value)).toBe("")
    }
  })
})
