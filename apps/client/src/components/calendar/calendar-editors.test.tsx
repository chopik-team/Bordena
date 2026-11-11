// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  generalCalendar,
  emptyCalendarState,
  type CalendarEvent,
} from "@bordena/contract"
import { CalendarEditor, EventEditor } from "./calendar-editors"
const save = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock("@/lib/calendar-data", () => ({
  saveCalendar: save,
  saveCalendarEvent: save,
  cancelCalendarPlan: save,
}))
vi.mock("@/lib/exchange/changeset", () => ({ applyOperations: save }))
vi.mock("../history/history-modal", () => ({ HistoryModal: () => null }))
const event: CalendarEvent = {
  id: "qa-draft",
  calendarId: generalCalendar().id,
  title: "Встреча",
  description: "",
  kind: "event",
  start: "2026-11-10T09:00:00Z",
  end: "2026-11-10T10:00:00Z",
  timeZone: "UTC",
  allDay: false,
  status: "planned",
  links: [],
  priority: "medium",
  flexible: false,
  pinned: false,
  syncCompletion: false,
  allowArchived: false,
  updatedAt: 1,
  deletedAt: null,
}
const sources = { cards: [], columns: [], dashboards: [] }
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "matchMedia", {
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  })
})
afterEach(() => {
  cleanup()
  save.mockClear()
})
function renderEvent(onClose = vi.fn()) {
  render(
    <EventEditor
      value={event}
      state={{ ...emptyCalendarState(), events: [event] }}
      sources={sources}
      onClose={onClose}
      onOpenSource={vi.fn()}
    />
  )
  return onClose
}
describe("calendar draft protection", () => {
  it("explains a stale form without asking the user to export data", async () => {
    const user = userEvent.setup(),
      close = renderEvent()
    save.mockRejectedValueOnce(
      new Error(
        "Stale revision: export the latest data before applying changes"
      )
    )
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Запись изменена в другом окне. Откройте её заново."
    )
    expect(close).not.toHaveBeenCalled()
  })
  it("keeps dirty event on Escape, offers continue/discard, closes a pristine editor immediately", async () => {
    const user = userEvent.setup(),
      close = renderEvent()
    await user.clear(screen.getByRole("textbox", { name: "Название" }))
    await user.type(
      screen.getByRole("textbox", { name: "Название" }),
      "Новый текст"
    )
    await user.keyboard("{Escape}")
    expect(close).not.toHaveBeenCalled()
    await user.click(
      await screen.findByRole("button", { name: "Вернуться к редактированию" })
    )
    await waitFor(() =>
      expect(
        screen.queryByText(
          "Сохраните изменения или отмените их перед закрытием."
        )
      ).toBeNull()
    )
    expect(
      (screen.getByRole("textbox", { name: "Название" }) as HTMLInputElement)
        .value
    ).toBe("Новый текст")
    await user.keyboard("{Escape}")
    await user.click(
      await screen.findByRole("button", { name: "Не сохранять" })
    )
    expect(close).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
  })
  it("saves the draft through the same validated form before closing", async () => {
    const user = userEvent.setup(),
      close = renderEvent()
    await user.type(
      screen.getByRole("textbox", { name: "Название" }),
      " изменено"
    )
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("dialog", {
      name: "Есть несохранённые изменения",
    })
    await user.click(within(prompt).getByRole("button", { name: "Сохранить" }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Встреча изменено" })
    )
  })
  it("does not close a dirty calendar without explicit discard", async () => {
    const user = userEvent.setup(),
      close = vi.fn()
    render(
      <CalendarEditor
        value={{ ...generalCalendar(), id: "qa-custom", title: "Работа" }}
        state={emptyCalendarState()}
        sources={sources}
        onClose={close}
      />
    )
    await user.type(
      screen.getByRole("textbox", { name: "Название" }),
      " CHOPIK"
    )
    await user.keyboard("{Escape}")
    expect(close).not.toHaveBeenCalled()
    await user.click(
      await screen.findByRole("button", { name: "Не сохранять" })
    )
    expect(close).toHaveBeenCalledOnce()
  })
  it("retains an empty date input and blocks submission instead of silently restoring the old date", async () => {
    const user = userEvent.setup(),
      close = renderEvent()
    const date = document.querySelector(
      'input[type="datetime-local"]'
    ) as HTMLInputElement
    await user.clear(date)
    expect(date.value).toBe("")
    expect(date.checkValidity()).toBe(false)
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(save).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})
