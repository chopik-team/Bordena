import { describe, it, expect } from "vitest"
import {
  parseInlineDate,
  inlineDateUrl,
  replaceInlineDate,
} from "./inline-date"

describe("portable dates anchored in Markdown", () => {
  it("preserves labels, unique IDs, other dates and the surrounding Markdown", () => {
    const first = inlineDateUrl("2026-10-18T17:40:00+03:00", "one"),
      second = inlineDateUrl("2026-10-18", "two")
    const body = `# Задача\n[Монтаж](${first}) и [Запись](${second}) **вечером**`
    const next = replaceInlineDate(body, first, "2026-10-19")
    expect(next).toBe(
      `# Задача\n[Монтаж](${inlineDateUrl("2026-10-19", "one")}) и [Запись](${second}) **вечером**`
    )
    expect(parseInlineDate(first)).toEqual({
      id: "one",
      value: "2026-10-18T17:40:00+03:00",
    })
    expect(replaceInlineDate(body, first, null)).toContain(
      `Монтаж и [Запись](${second})`
    )
  })
  it("keeps escaped words readable and rejects duplicate IDs or newer anchors", () => {
    const url = inlineDateUrl("2026-10-18", "id")
    expect(replaceInlineDate(`[Этап \\[1\\]](${url})`, url, null)).toBe(
      "Этап \\[1\\]"
    )
    expect(() =>
      replaceInlineDate(`[A](${url}) [B](${url})`, url, null)
    ).toThrow(/changed/)
    expect(() =>
      replaceInlineDate(`[A](${inlineDateUrl("2026-10-19", "id")})`, url, null)
    ).toThrow(/changed/)
  })
  it("rejects impossible dates, malformed encodings, active URLs and injected fragments", () => {
    for (const value of [
      "#bordena-date=2026-02-31&id=id",
      "#bordena-date=%ZZ&id=id",
      "#bordena-date=javascript%3Aalert(1)&id=id",
      "#bordena-date=2026-10-18&id=../../x",
      "#bordena-date=2026-10-18&id=id&exec=x",
    ])
      expect(parseInlineDate(value)).toBeNull()
    expect(() => inlineDateUrl("2026-10-18T25:00", "id")).toThrow()
  })
})
