import { describe, expect, test } from "vitest"
import { dispositionFor, resolveType, safeMime } from "../src/server/content-type"

describe("safeMime", () => {
  test.each([
    ["image/png", "image/png"],
    ["application/vnd.api+json", "application/vnd.api+json"],
    // A header can arrive repeated; the first one wins.
    [["image/png", "text/html"], "image/png"],
    // Anything that isn't a bare type/subtype token is not echoed back — a
    // parameter is where a header injection would hide.
    ["image/png; charset=utf-8", "application/octet-stream"],
    ["image/png\r\nX-Evil: 1", "application/octet-stream"],
    ["notamime", "application/octet-stream"],
    ["", "application/octet-stream"],
    [undefined, "application/octet-stream"],
  ])("%j → %s", (raw, expected) => {
    expect(safeMime(raw)).toBe(expected)
  })
})

describe("resolveType", () => {
  test("a real stored type wins over the extension", () => {
    expect(resolveType("att/x.png", "image/webp")).toBe("image/webp")
  })

  test("octet-stream falls through to the extension", () => {
    expect(resolveType("att/x.png", "application/octet-stream")).toBe(
      "image/png"
    )
  })

  test("no stored type infers from the extension — the filesystem path", () => {
    expect(resolveType("att/x.pdf", undefined)).toBe("application/pdf")
  })

  test("an unknown or absent extension stays octet-stream", () => {
    expect(resolveType("att/x.bin", undefined)).toBe("application/octet-stream")
    expect(resolveType("att/x", undefined)).toBe("application/octet-stream")
  })

  test("html is never inferred, whatever the extension says", () => {
    expect(resolveType("att/x.html", undefined)).toBe(
      "application/octet-stream"
    )
  })
})

describe("dispositionFor", () => {
  test.each(["image/png", "application/pdf", "video/mp4", "text/plain"])(
    "%s renders inline",
    (type) => {
      expect(dispositionFor(type)).toBe("inline")
    }
  )

  test.each([
    "text/html",
    "image/svg+xml",
    "application/javascript",
    "application/octet-stream",
  ])("%s downloads", (type) => {
    expect(dispositionFor(type)).toBe("attachment")
  })
})
