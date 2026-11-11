import { ORPCError } from "@orpc/client"
import { beforeEach, describe, expect, it } from "vitest"
import type { Runtime } from "../src/runtime"
import { installRuntime } from "../src/runtime"

let online = true

const runtimeStub = {
  db: { get: () => Promise.resolve(undefined), set: () => Promise.resolve() },
  kv: { get: () => null, set: () => {}, remove: () => {} },
  net: { online: () => online, subscribe: () => () => {} },
  http: { isConfigured: () => false, subscribe: () => () => {} },
}

beforeEach(() => {
  online = true
  installRuntime(runtimeStub as unknown as Runtime)
})

describe("classify", () => {
  it("tells a dead session from a board we may not have", async () => {
    const { classify } = await import("../src/api/sync/sync-engine")

    expect(classify(new ORPCError("UNAUTHORIZED", { status: 401 }))).toBe(
      "auth"
    )
    expect(classify(new ORPCError("FORBIDDEN", { status: 403 }))).toBe(
      "forbidden"
    )
    expect(classify(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe("server")
  })

  it("calls anything offline while the device is offline", async () => {
    const { classify } = await import("../src/api/sync/sync-engine")
    online = false

    expect(classify(new ORPCError("FORBIDDEN", { status: 403 }))).toBe(
      "offline"
    )
  })
})
