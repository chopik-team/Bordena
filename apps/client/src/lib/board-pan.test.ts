// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { installBoardPan } from "./board-pan"

let dispose = () => {}
afterEach(() => {
  dispose()
  document.body.innerHTML = ""
})
function setup() {
  const root = document.createElement("div"),
    child = document.createElement("div")
  child.style.overflowY = "auto"
  Object.defineProperties(child, {
    scrollHeight: { value: 1000 },
    clientHeight: { value: 100 },
  })
  root.append(child)
  document.body.append(root)
  dispose = installBoardPan(root)
  return { root, child }
}
function pointer(el: EventTarget, type: string, args: MouseEventInit = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 1,
    buttons: 4,
    ...args,
  })
  Object.defineProperty(event, "pointerId", { value: 1 })
  el.dispatchEvent(event)
  return event
}
describe("middle mouse board pan", () => {
  it("pans horizontally and the hovered scrollable column vertically without dragging cards", () => {
    const { root, child } = setup()
    root.scrollLeft = 50
    child.scrollTop = 30
    const down = pointer(child, "pointerdown", { clientX: 100, clientY: 200 })
    expect(down.defaultPrevented).toBe(true)
    pointer(window, "pointermove", { clientX: 70, clientY: 150 })
    expect([root.scrollLeft, child.scrollTop]).toEqual([80, 80])
    expect(root.dataset.panning).toBe("true")
    pointer(window, "pointerup")
    expect(root.dataset.panning).toBeUndefined()
    pointer(window, "pointermove", { clientX: 0 })
    expect(root.scrollLeft).toBe(80)
  })
  it.each(["blur", "pointercancel", "lostpointercapture"])(
    "cleans up on %s and restores selection",
    (event) => {
      const { root, child } = setup()
      document.documentElement.style.userSelect = "text"
      pointer(child, "pointerdown")
      expect(document.documentElement.style.userSelect).toBe("none")
      if (event === "blur") window.dispatchEvent(new Event(event))
      else pointer(event === "lostpointercapture" ? root : window, event)
      expect(root.dataset.panning).toBeUndefined()
      expect(document.documentElement.style.userSelect).toBe("text")
    }
  )
  it("does not hijack input, Markdown editor, left click, or wheel", () => {
    const { root, child } = setup()
    for (const html of [
      "<input>",
      "<textarea></textarea>",
      '<div contenteditable="true"></div>',
      '<div class="cm-editor"></div>',
      "<button>OK</button>",
    ]) {
      child.innerHTML = html
      expect(
        pointer(child.firstElementChild!, "pointerdown").defaultPrevented
      ).toBe(false)
    }
    expect(pointer(child, "pointerdown", { button: 0 }).defaultPrevented).toBe(
      false
    )
    const wheel = new WheelEvent("wheel", { cancelable: true })
    root.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(false)
    expect(root.dataset.panning).toBeUndefined()
  })
})
