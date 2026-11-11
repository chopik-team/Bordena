import { describe, expect, it } from "vitest"
import { DashboardListDriver } from "../src/api/sync/drivers/dashboard-list-driver"

describe("DashboardListDriver.applyRemoved", () => {
  it("forgets every withdrawn board, one at a time", async () => {
    const forgotten: string[] = []
    const driver = new DashboardListDriver(async (boardId) => {
      forgotten.push(`start ${boardId}`)
      await Promise.resolve()
      forgotten.push(`done ${boardId}`)
    })

    await driver.applyRemoved(["b1", "b2"])

    // Serially: each drop reads the local stores the previous one is deleting from.
    expect(forgotten).toEqual(["start b1", "done b1", "start b2", "done b2"])
  })
})
