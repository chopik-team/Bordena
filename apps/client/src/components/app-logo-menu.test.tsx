// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppLogoMenu } from "./app-logo-menu"
import { AppSettings } from "./app-settings"
function TestMenu() {
  return (
    <>
      <AppLogoMenu />
      <AppSettings />
    </>
  )
}

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
afterEach(cleanup)

describe("AppLogoMenu", () => {
  it("offers the same author support address as Velora without opening it automatically", async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    await user.click(screen.getByRole("button", { name: "Меню Bordena" }))
    const link = await screen.findByRole("menuitem", {
      name: "Поддержать разработчика",
    })
    expect(link.getAttribute("href")).toBe("https://boosty.to/cho_pik")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.querySelector('[data-slot="boosty-logo"]')).toBeTruthy()
  })
  it("opens on left click, closes on repeat click and restores aria-expanded", async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    const trigger = screen.getByRole("button", { name: "Меню Bordena" })
    await user.click(trigger)
    expect(
      await screen.findByRole("menuitem", { name: "Настройки Bordena" })
    ).toBeTruthy()
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    await user.click(trigger)
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })
  it("closes on outside click", async () => {
    const user = userEvent.setup()
    render(
      <>
        <TestMenu />
        <button>Снаружи</button>
      </>
    )
    await user.click(screen.getByRole("button", { name: "Меню Bordena" }))
    await screen.findByRole("menu")
    await user.click(screen.getByText("Снаружи"))
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
  })
  it.each(["{Enter}", " "])(
    "supports keyboard %s and Esc with focus return",
    async (key) => {
      const user = userEvent.setup()
      render(<TestMenu />)
      const trigger = screen.getByRole("button", { name: "Меню Bordena" })
      trigger.focus()
      await user.keyboard(key)
      await screen.findByRole("menu")
      await user.keyboard("{Escape}")
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    }
  )
  it("opens shared settings", async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    await user.click(screen.getByRole("button", { name: "Меню Bordena" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "Настройки Bordena" })
    )
    expect(await screen.findByRole("dialog")).toBeTruthy()
  })
  it("shows About and upstream credit", async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    await user.click(screen.getByRole("button", { name: "Меню Bordena" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "О программе" })
    )
    expect(await screen.findByText(`Bordena ${__APP_VERSION__}`)).toBeTruthy()
    expect(
      screen.getByText(/В Bordena использована часть кода Doska/)
    ).toBeTruthy()
    expect(screen.getByText("Станислав Смирнов")).toBeTruthy()
    expect(screen.getByText("CHOPIK Team")).toBeTruthy()
    const support = screen.getByRole("link", {
      name: "Поддержать разработчика · Boosty",
    })
    expect(support.getAttribute("href")).toBe("https://boosty.to/cho_pik")
    expect(support.querySelector('[data-slot="boosty-logo"]')).toBeTruthy()
  })
  it("renders the actual CHANGELOG.md", async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    await user.click(screen.getByRole("button", { name: "Меню Bordena" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "История изменений" })
    )
    expect(await screen.findByText("AW 0.1")).toBeTruthy()
    expect(screen.getByText(/Интерактивный логотип с плавной/)).toBeTruthy()
  })
})
