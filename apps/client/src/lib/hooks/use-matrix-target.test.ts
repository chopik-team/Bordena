// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"
import { matrixPointerDestination } from "./use-matrix-target"
afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})
function setup() {
  document.body.innerHTML =
    '<div data-matrix><div data-matrix-cell="stage|state"><div data-rfd-draggable-id="a"></div><div data-rfd-draggable-id="moved"></div><div data-rfd-draggable-id="b"></div></div></div>'
  const surface = document.querySelector("[data-matrix]")!,
    cell = surface.firstElementChild as HTMLElement
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => cell),
  })
  for (const [i, card] of [...cell.children].entries())
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      y: 100 + i * 100,
      height: 50,
    } as DOMRect)
  return { surface, cell }
}
it("resolves both grid axes and insertion index using the pointer, excluding the dragged card", () => {
  const { surface } = setup()
  expect(matrixPointerDestination(surface, 10, 50, "moved")).toEqual({
    droppableId: "matrix|stage|state",
    index: 0,
  })
  expect(matrixPointerDestination(surface, 10, 200, "moved")).toEqual({
    droppableId: "matrix|stage|state",
    index: 1,
  })
  expect(matrixPointerDestination(surface, 10, 400, "moved")?.index).toBe(2)
})
it("refuses collapsed rows and points outside the current board", () => {
  const { surface, cell } = setup()
  cell.dataset.collapsed = "true"
  expect(matrixPointerDestination(surface, 0, 0, "moved")).toBeNull()
  expect(
    matrixPointerDestination(document.createElement("div"), 0, 0, "moved")
  ).toBeNull()
})
