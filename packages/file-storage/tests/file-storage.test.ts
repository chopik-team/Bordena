import { describe, expect, test } from "vitest"
import { extname } from "../src/file-storage"

describe("extname", () => {
  test.each([
    ["photo.png", ".png"],
    ["photo.PNG", ".png"],
    ["archive.tar.gz", ".gz"],
    // A dotfile is a name, not an extension.
    [".gitignore", ""],
    ["no-extension", ""],
    // A trailing dot leaves nothing to take.
    ["trailing.", ""],
    ["", ""],
  ])("%j → %j", (name, expected) => {
    expect(extname(name)).toBe(expected)
  })
})
