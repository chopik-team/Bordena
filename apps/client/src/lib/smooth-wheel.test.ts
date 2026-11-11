// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installMonthWheel, installSmoothWheel } from "./smooth-wheel"
let clock = 0,
  serial = 0,
  stop = () => {}
const frames = new Map<number, FrameRequestCallback>()
const motion = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}
beforeEach(() => {
  clock = serial = 0
  frames.clear()
  motion.matches = false
  vi.stubGlobal("matchMedia", () => motion)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++serial, callback)
    return serial
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})
afterEach(() => {
  stop()
  document.body.innerHTML = ""
  delete document.documentElement.dataset.animations
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function setup() {
  const el = document.createElement("div")
  el.style.lineHeight = "20px"
  document.body.append(el)
  Object.defineProperties(el, {
    scrollHeight: { value: 2000 },
    clientHeight: { value: 500 },
  })
  el.scrollTop = 400
  stop = installSmoothWheel(el)
  return el
}
function wheel(el: HTMLElement, init: WheelEventInit = {}) {
  const e = new WheelEvent("wheel", {
    deltaY: 120,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  el.dispatchEvent(e)
  return e
}
function advance(now: number) {
  clock = now
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(now))
}
describe("month wheel navigation", () => {
  function month() {
    const el = setup(),
      step = vi.fn()
    stop()
    stop = installMonthWheel(el, step)
    return { el, step }
  }
  it("changes one month per gesture and handles a reversed or later gesture", () => {
    const { el, step } = month()
    wheel(el)
    wheel(el)
    expect(step.mock.calls).toEqual([[1]])
    wheel(el, { deltaY: -120 })
    expect(step.mock.calls).toEqual([[1], [-1]])
    clock = 200
    wheel(el, { deltaY: -120 })
    expect(step.mock.calls).toEqual([[1], [-1], [-1]])
  })
  it("accumulates fine touchpad movement without skipping months", () => {
    const { el, step } = month()
    for (let i = 0; i < 5; i++) wheel(el, { deltaY: 10 })
    expect(step).not.toHaveBeenCalled()
    wheel(el, { deltaY: 10 })
    wheel(el, { deltaY: 500 })
    expect(step).toHaveBeenCalledTimes(1)
  })
  it("preserves controls and modifier gestures and works with reduced motion", () => {
    const { el, step } = month()
    const input = document.createElement("input")
    el.append(input)
    expect(wheel(input).defaultPrevented).toBe(false)
    expect(wheel(el, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(wheel(el, { deltaX: 150 }).defaultPrevented).toBe(false)
    motion.matches = true
    document.documentElement.dataset.animations = "off"
    wheel(el)
    expect(step).toHaveBeenCalledWith(1)
  })
  it("removes its listener on disposal", () => {
    const { el, step } = month()
    stop()
    expect(wheel(el).defaultPrevented).toBe(false)
    expect(step).not.toHaveBeenCalled()
  })
})
describe("calendar wheel motion", () => {
  it("does not move backwards when a frame timestamp precedes the wheel handler", () => {
    const el = setup()
    clock = 20
    wheel(el)
    advance(16)
    expect(el.scrollTop).toBe(400)
    advance(200)
    expect(el.scrollTop).toBe(520)
  })
  it("animates wheel steps and preserves accumulated distance in a burst", () => {
    const el = setup()
    expect(wheel(el).defaultPrevented).toBe(true)
    expect(el.scrollTop).toBe(400)
    advance(16)
    expect(el.scrollTop).toBeGreaterThan(400)
    expect(el.scrollTop).toBeLessThan(520)
    wheel(el)
    advance(180)
    expect(el.scrollTop).toBe(640)
    expect(frames.size).toBe(0)
  })
  it("reverses immediately instead of completing motion in the previous direction", () => {
    const el = setup()
    wheel(el)
    advance(60)
    const before = el.scrollTop
    wheel(el, { deltaY: -120 })
    advance(76)
    expect(el.scrollTop).toBeLessThan(before)
    advance(220)
    expect(el.scrollTop).toBeCloseTo(before - 120)
  })
  it.each([
    [1, 3, 60],
    [2, 1, 500],
  ])("honors wheel delta mode %s", (deltaMode, deltaY, distance) => {
    const el = setup()
    wheel(el, { deltaMode, deltaY })
    advance(200)
    expect(el.scrollTop).toBe(400 + distance)
  })
  it("leaves fine touchpad movement, horizontal gestures, controls and reduced motion native", () => {
    const el = setup()
    for (const init of [
      { deltaY: 3 },
      { deltaX: 120, deltaY: 1 },
      { ctrlKey: true },
      { shiftKey: true },
    ])
      expect(wheel(el, init).defaultPrevented).toBe(false)
    const input = document.createElement("input")
    el.append(input)
    expect(wheel(input).defaultPrevented).toBe(false)
    motion.matches = true
    expect(wheel(el).defaultPrevented).toBe(false)
    motion.matches = false
    document.documentElement.dataset.animations = "off"
    expect(wheel(el).defaultPrevented).toBe(false)
    expect(el.scrollTop).toBe(400)
    expect(frames.size).toBe(0)
  })
  it("clamps at the end and cancels on pointer interaction or cleanup", () => {
    const el = setup()
    el.scrollTop = 1490
    wheel(el)
    advance(200)
    expect(el.scrollTop).toBe(1500)
    expect(wheel(el).defaultPrevented).toBe(false)
    el.scrollTop = 400
    wheel(el)
    el.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    advance(400)
    expect(el.scrollTop).toBe(400)
    wheel(el)
    stop()
    advance(600)
    expect(el.scrollTop).toBe(400)
    expect(frames.size).toBe(0)
  })
  it("does not overwrite a keyboard, scrollbar or date-navigation scroll", () => {
    const el = setup()
    wheel(el)
    el.scrollTop = 80
    advance(200)
    expect(el.scrollTop).toBe(80)
    expect(frames.size).toBe(0)
  })
})
