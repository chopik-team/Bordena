import { describe, expect, it } from "vitest"
import { attachmentUnavailable, imageUnavailable } from "../src/data/attachment-labels"

describe("attachmentUnavailable", () => {
  it("blames the connection when sync has dropped", () => {
    expect(attachmentUnavailable({ status: "dropped", reason: "server" })).toBe(
      "Can't reach the server. Files are stored there."
    )
    expect(attachmentUnavailable({ status: "dropped", reason: "offline" })).toBe(
      "You're offline. Files are stored on the server."
    )
    expect(attachmentUnavailable({ status: "dropped", reason: "auth" })).toBe(
      "Signed out on the server. Sign in to see files."
    )
    expect(
      attachmentUnavailable({ status: "dropped", reason: "forbidden" })
    ).toBe("No access to this file.")
  })

  it("points a signed out reader at signing in", () => {
    expect(attachmentUnavailable({ status: "local" })).toBe(
      "Sign in to see files."
    )
  })

  // Sync is fine, so the server is answering and this one object is genuinely
  // gone. Claiming the server is away here would be a lie.
  it("does not blame the connection while sync is healthy", () => {
    expect(attachmentUnavailable({ status: "ok" })).toBe("File unavailable.")
  })

  // A public board's visitor has no session at all, so it reads as "local".
  it("never tells a public visitor to sign in", () => {
    expect(attachmentUnavailable({ status: "local" }, "token")).toBe(
      "File unavailable."
    )
    expect(
      attachmentUnavailable({ status: "dropped", reason: "auth" }, "token")
    ).toBe("File unavailable.")
  })
})

describe("imageUnavailable", () => {
  const sync = (
    hasUrl: boolean,
    failedAt: "ok" | "local" | "dropped" | null,
    status: "ok" | "local" | "dropped"
  ) => imageUnavailable({ source: "sync", hasUrl, failedAt, status })

  it("shows the image while nothing has gone wrong", () => {
    expect(sync(true, null, "ok")).toBe(false)
    expect(sync(true, null, "dropped")).toBe(false)
  })

  it("waits rather than complaining while a URL is still resolving", () => {
    expect(sync(false, null, "ok")).toBe(false)
  })

  it("gives up on a URL that can't resolve without the server", () => {
    expect(sync(false, null, "dropped")).toBe(true)
    expect(sync(false, null, "local")).toBe(true)
  })

  // Sync was healthy when the <img> errored, so the object itself is gone and
  // no amount of reconnecting brings it back.
  it("stays failed when it broke while sync was healthy", () => {
    expect(sync(true, "ok", "ok")).toBe(true)
    expect(sync(true, "ok", "dropped")).toBe(true)
  })

  it("retries an outage failure once sync is back", () => {
    expect(sync(true, "dropped", "dropped")).toBe(true)
    expect(sync(true, "dropped", "ok")).toBe(false)
  })

  // A token URL is built locally, so the reader's own sync state says nothing
  // about whether the file is there.
  it("ignores the connection for token-served files", () => {
    const token = (
      hasUrl: boolean,
      failedAt: "ok" | "dropped" | null,
      status: "ok" | "local" | "dropped"
    ) => imageUnavailable({ source: "token", hasUrl, failedAt, status })

    expect(token(true, null, "local")).toBe(false)
    expect(token(false, null, "dropped")).toBe(false)
    expect(token(true, "ok", "ok")).toBe(true)
  })
})
