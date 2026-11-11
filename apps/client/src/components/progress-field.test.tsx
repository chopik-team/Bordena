// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ProgressField, ProgressIndicator } from "./progress-field"
afterEach(cleanup)
it("keeps blank different from 0, and commits 100", () => {
  const save = vi.fn()
  render(<ProgressField value={null} onCommit={save} />)
  const field = screen.getByRole("spinbutton")
  expect((field as HTMLInputElement).value).toBe("")
  fireEvent.change(field, { target: { value: "0" } })
  fireEvent.keyDown(field, { key: "Enter" })
  expect(save).toHaveBeenLastCalledWith(0)
  fireEvent.blur(field)
  expect(save).toHaveBeenCalledTimes(1)
  fireEvent.change(field, { target: { value: "100" } })
  fireEvent.blur(field)
  expect(save).toHaveBeenLastCalledWith(100)
})
it("clears a set value to null without changing checklist counters", () => {
  const save = vi.fn()
  render(<ProgressField value={65} onCommit={save} />)
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } })
  fireEvent.blur(screen.getByRole("spinbutton"))
  expect(save).toHaveBeenCalledWith(null)
})
it("rejects out-of-range values and Escape cancels an edit", () => {
  const save = vi.fn()
  render(<ProgressField value={50} onCommit={save} />)
  const field = screen.getByRole("spinbutton")
  fireEvent.change(field, { target: { value: "101" } })
  fireEvent.blur(field)
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole("alert")).toBeTruthy()
  fireEvent.keyDown(field, { key: "Escape" })
  expect((field as HTMLInputElement).value).toBe("50")
})
it("shows an accessible indicator for 0 but none for unset", () => {
  const { rerender } = render(<ProgressIndicator value={null} />)
  expect(screen.queryByRole("progressbar")).toBeNull()
  rerender(<ProgressIndicator value={0} />)
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "0"
  )
})
