import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Runtime } from "../src/runtime"

/** A DB whose writes only land on `flush`, so a test can drop the ones a killed
 * app would never have committed. */
const committed = new Map<string, unknown>()
let inflight: (() => void)[] = []

const db = {
  get: (store: string, key: string) =>
    Promise.resolve(committed.get(`${store}/${key}`)),
  set: (store: string, key: string, value: unknown) =>
    new Promise<void>((resolve) => {
      inflight.push(() => {
        committed.set(`${store}/${key}`, value)
        resolve()
      })
    }),
}

/** The synchronous mirror. Survives a relaunch, like the real one. */
const kvStore = new Map<string, string>()

const kv = {
  get: (key: string) => kvStore.get(key) ?? null,
  set: (key: string, value: string) => void kvStore.set(key, value),
}

const flush = () => {
  const writes = inflight
  inflight = []
  for (const write of writes) write()
}

/** A cold start: fresh module state, seeded from whatever actually committed. */
async function relaunch() {
  vi.resetModules()
  const { installRuntime } = await import("../src/runtime")
  installRuntime({ db, kv } as unknown as Runtime)
  const hlc = await import("../src/api/sync/hlc")
  await hlc.seedClock()
  return hlc
}

beforeEach(() => {
  committed.clear()
  inflight = []
  kvStore.clear()
  vi.resetModules()
})

describe("hlc", () => {
  it("keeps timestamps ascending across a clean restart", async () => {
    const first = await relaunch()
    const t1 = first.stamp()
    flush()

    const second = await relaunch()
    expect(second.stamp()).toBeGreaterThan(t1)
  })

  it("keeps timestamps ascending across a restart that lost the last write", async () => {
    const first = await relaunch()
    // A pulled record stamped an hour ahead, so the clock now issues timestamps
    // above wall-clock time — the case where a regression does damage.
    first.clock.receive(Date.now() + 3_600_000)
    const t1 = first.stamp()
    // No flush: the OS kills the app before the mark commits.

    const second = await relaunch()
    expect(second.stamp()).toBeGreaterThan(t1)
  })
})
