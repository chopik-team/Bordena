// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { plural, resolveLocale, setLanguage, t } from "@bordena/i18n"
import { dictionary } from "../../../../packages/i18n/src/messages"
import { InterfaceSection } from "../components/settings/sections/interface"
import {
  parsePreferences,
  setPreferences,
  preferencesSnapshot,
} from "./preferences"
import { guideTopics } from "./guide"

afterEach(() => {
  cleanup()
  setPreferences({ language: "ru" })
})
describe("local interface preferences and translations", () => {
  it("accepts another window's preferences without writing them back or looping", () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "bordena:preferences:v1",
        newValue: JSON.stringify({
          ...preferencesSnapshot(),
          language: "en",
          theme: "dark",
        }),
      })
    )
    expect(preferencesSnapshot()).toMatchObject({
      language: "en",
      theme: "dark",
    })
    expect(t("Данные")).toBe("Data")
  })
  it("uses Russian only for a Russian OS language and English for other locales", () => {
    expect(resolveLocale("system", "ru-RU")).toBe("ru")
    expect(resolveLocale("system", "de-DE")).toBe("en")
    expect(resolveLocale("en", "ru-RU")).toBe("en")
  })
  it("keeps corrupt or unsupported preferences from affecting board access", () => {
    expect(parsePreferences("{broken")).toEqual(parsePreferences(null))
    expect(
      parsePreferences(
        '{"workspaceId":"../bad","theme":"unknown","density":42,"panning":null}'
      )
    ).toMatchObject({
      workspaceId: "default",
      theme: "system",
      density: "normal",
      panning: true,
    })
  })
  it("formats RU plurals and interpolates only supplied system placeholders", () => {
    const forms = {
      ru: ["карточка", "карточки", "карточек"] as [string, string, string],
      en: ["card", "cards"] as [string, string],
    }
    setLanguage("ru")
    expect([1, 2, 5, 21].map((n) => plural(n, forms))).toEqual([
      "карточка",
      "карточки",
      "карточек",
      "карточка",
    ])
    setLanguage("en")
    expect(plural(2, forms)).toBe("cards")
    expect(t("Переместить секцию: {p0}", { p0: "Мой проект ё" })).toBe(
      "Move section: Мой проект ё"
    )
  })
  it("switches language without remounting or losing a user's draft", async () => {
    const user = userEvent.setup()
    function Screen() {
      const [draft, setDraft] = useState("Заметка пользователя ё")
      return (
        <>
          <textarea
            aria-label="draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <InterfaceSection />
        </>
      )
    }
    render(<Screen />)
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Язык" }),
      "en"
    )
    expect(screen.getByRole("combobox", { name: "Language" })).toBeTruthy()
    expect(
      (screen.getByRole("textbox", { name: "draft" }) as HTMLTextAreaElement)
        .value
    ).toBe("Заметка пользователя ё")
  })
  it("has matching placeholders in both languages", () => {
    const placeholders = (value: string) =>
      value.match(/\{\w+\}/g)?.sort() ?? []
    for (const item of Object.values(dictionary))
      expect(placeholders(item.en)).toEqual(placeholders(item.ru))
  })
  it("ships all forty-one complete guide topics in both languages", () => {
    expect(guideTopics).toHaveLength(41)
    expect(new Set(guideTopics.map((topic) => topic.id)).size).toBe(41)
    for (const topic of guideTopics) {
      expect(topic.ru.body.length).toBeGreaterThan(100)
      expect(topic.en.body.length).toBeGreaterThan(100)
    }
  })
})
