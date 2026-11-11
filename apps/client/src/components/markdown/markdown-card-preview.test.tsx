// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach } from "vitest"
import { MarkdownCardPreview } from "./markdown-card-preview"
afterEach(cleanup)
describe("bounded card notes", () => {
  it("expands a long preview without editing Markdown or opening the parent card", async () => {
    const user = userEvent.setup(),
      open = vi.fn(),
      change = vi.fn(),
      body = Array.from(
        { length: 12 },
        (_, i) => "Paragraph " + i + " of the original note."
      ).join("\n\n")
    render(
      <div onClick={open}>
        <MarkdownCardPreview
          preview={body}
          body={body}
          hasMore={false}
          compact
          onChangeBody={change}
        />
      </div>
    )
    const toggle = screen.getByRole("button")
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    await user.click(toggle)
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(open).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
    await user.click(toggle)
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.getByText("Paragraph 11 of the original note.")).toBeTruthy()
  })
  it("keeps normal full previews and short card notes free of an expansion control", () => {
    const body = "A short note."
    render(
      <MarkdownCardPreview preview={body} body={body} hasMore={false} compact />
    )
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.getByText(body)).toBeTruthy()
  })
})
