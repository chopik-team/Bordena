import { describe, expect, it } from "vitest"
import { displayVersion, releaseChannel } from "../../../../packages/utils/src/versions"
describe("release presentation does not replace machine versions", () => {
  it("maps the approved historical labels without inventing ambiguous mappings", () => {
    expect(displayVersion("0.8.2")).toBe("AW 0.82")
    expect(displayVersion("0.8.1")).toBe("AW 0.81")
    expect(displayVersion("0.7.1")).toBe("AW 0.71")
    expect(displayVersion("0.8.0")).toBe("AW 0.8")
    expect(displayVersion("0.10.12")).not.toBe(displayVersion("0.11.2"))
  })
  it("keeps public, staging and development versions distinct", () => {
    expect(displayVersion("1.0.0")).toBe("W 1.0")
    expect(displayVersion("1.0.1")).toBe("W 1.0.1")
    expect(releaseChannel("1.0.0")).toBe("stable")
    expect(releaseChannel("1.0.1-rc.1")).toBe("dev")
    expect(() => displayVersion("AW 0.82")).toThrow()
  })
})
