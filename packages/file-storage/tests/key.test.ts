import { describe, expect, test } from "vitest"
import { isValidKey, newKey } from "../src/server/key"

describe("newKey", () => {
  test("keeps a plain lowercase extension", () => {
    expect(newKey("photo.PNG")).toMatch(/^att\/[0-9a-f-]{36}\.png$/)
  })

  test("drops an extension that isn't a plain suffix", () => {
    for (const name of ["archive.tar.gz", "weird.p ng", "no-extension"]) {
      expect(isValidKey(newKey(name))).toBe(true)
    }
    expect(newKey("no-extension")).toMatch(/^att\/[0-9a-f-]{36}$/)
  })

  test("the name never becomes the identity", () => {
    const key = newKey("../../etc/passwd")
    expect(key).not.toContain("passwd")
    expect(isValidKey(key)).toBe(true)
  })

  test("two puts of the same name don't collide", () => {
    expect(newKey("a.txt")).not.toBe(newKey("a.txt"))
  })

  test("what it mints, isValidKey accepts", () => {
    for (const name of ["a.txt", "b.png", "c", "d.tar.gz"]) {
      expect(isValidKey(newKey(name))).toBe(true)
    }
  })
})

describe("isValidKey", () => {
  const uuid = "0f8fad5b-d9cb-469f-a165-70867728950e"

  test.each([
    [`att/${uuid}`, true],
    [`att/${uuid}.png`, true],
    // Wrong prefix, or none.
    [`${uuid}.png`, false],
    [`files/${uuid}.png`, false],
    [`att/att/${uuid}.png`, false],
    // Traversal, in the forms a URL can deliver it.
    ["../../etc/passwd", false],
    [`att/../../etc/passwd`, false],
    [`att/${uuid}/../../../etc/passwd`, false],
    ["att/..", false],
    // Absolute paths.
    [`/etc/passwd`, false],
    [`att//etc/passwd`, false],
    // Not a UUID.
    ["att/note.txt", false],
    ["att/../secret", false],
    [`att/${uuid.toUpperCase()}.png`, false],
    [`att/${uuid}.PNG`, false],
    [`att/${uuid}.tar.gz`, false],
    // Empty-ish.
    ["", false],
    ["att/", false],
    ["att", false],
    // A NUL byte, which some path APIs treat specially.
    [`att/${uuid}\0.png`, false],
  ])("%j → %s", (key, expected) => {
    expect(isValidKey(key)).toBe(expected)
  })
})
