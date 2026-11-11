// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  DateInput,
  DateTimeCalendar,
  deadlineLocalParts,
  localDeadline,
} from "@bordena/ui-kit"
afterEach(cleanup)
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  })
})
describe("shared date and optional time calendar", () => {
  it("stages changes, saves a local timestamp with its offset, and closes the popup", async () => {
    const save = vi.fn(),
      user = userEvent.setup()
    render(
      <DateInput
        withTime
        value={null}
        onChange={save}
        inputProps={{ "aria-label": "Календарь" }}
      >
        Выбрать
      </DateInput>
    )
    await user.click(screen.getByRole("button", { name: "Календарь" }))
    const date = await screen.findByLabelText("Дата календаря")
    fireEvent.change(date, { target: { value: "2026-12-19" } })
    await user.click(screen.getByRole("checkbox", { name: "Указать время" }))
    fireEvent.change(screen.getByLabelText("Время календаря"), {
      target: { value: "17:40" },
    })
    expect(save).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Применить" }))
    expect(save).toHaveBeenCalledWith(localDeadline("2026-12-19", "17:40"))
    expect(screen.queryByLabelText("Дата календаря")).toBeNull()
  })
  it("converts offset input into local fields and clearing time keeps a date-only deadline", async () => {
    const save = vi.fn(),
      value = "2026-12-19T23:40:00-05:00",
      local = deadlineLocalParts(value),
      user = userEvent.setup()
    render(<DateTimeCalendar value={value} onSelect={save} />)
    expect(
      (screen.getByLabelText("Дата календаря") as HTMLInputElement).value
    ).toBe(local.date)
    expect(
      (screen.getByLabelText("Время календаря") as HTMLInputElement).value
    ).toBe(local.time)
    await user.click(screen.getByRole("checkbox", { name: "Указать время" }))
    await user.click(screen.getByRole("button", { name: "Применить" }))
    expect(save).toHaveBeenCalledWith(local.date)
  })
  it("clears a deadline explicitly and cancels a draft with Escape", async () => {
    const save = vi.fn(),
      user = userEvent.setup()
    const mounted = render(
      <DateTimeCalendar value="2026-12-19" onSelect={save} />
    )
    await user.click(screen.getByRole("button", { name: "Убрать дату" }))
    expect(save).toHaveBeenCalledWith(null)
    mounted.unmount()
    save.mockClear()
    render(
      <DateInput
        withTime
        value="2026-12-19"
        onChange={save}
        inputProps={{ "aria-label": "Календарь" }}
      >
        Дата
      </DateInput>
    )
    await user.click(screen.getByRole("button", { name: "Календарь" }))
    await screen.findByLabelText("Дата календаря")
    fireEvent.change(screen.getByLabelText("Дата календаря"), {
      target: { value: "2026-12-21" },
    })
    await user.keyboard("{Escape}")
    expect(save).not.toHaveBeenCalled()
    expect(screen.queryByLabelText("Дата календаря")).toBeNull()
  })
})
