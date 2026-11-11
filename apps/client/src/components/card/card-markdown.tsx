import { useEffect, useMemo, type ReactNode } from "react"
import { MarkdownRenderersProvider } from "@bordena/markdown"
import { CardAttachmentImage } from "./attachments/card-attachment-image"
import { CardRefLink } from "./refs/card-ref-link"
import { useDeck } from "@/providers/deck/deck-context"
import { parseInlineDate } from "@/lib/inline-date"
import { InlineDateLink } from "./deadline/inline-date-link"
import { navigate } from "wouter/use-browser-location"

/**
 * Resolves the parts of a card body that need app data — attachment images and
 * `[[12]]` card refs. Wrap anything rendering a body; image refs are scoped to
 * the card that owns the attachment, so the card is as wide as this can go.
 */
export function CardMarkdown({
  cardId,
  children,
  body,
  onChangeBody,
}: {
  cardId: string
  children: ReactNode
  body?: string
  onChangeBody?: (body: string) => void
}) {
  const { toggleTagFilter } = useDeck()
  useEffect(() => {
    let value: { cardId?: string; id?: string } | undefined
    try {
      value = JSON.parse(
        sessionStorage.getItem("bordena:calendar:focus") ?? "null"
      )
    } catch {
      return
    }
    if (
      value?.cardId !== cardId ||
      !value?.id ||
      !/^[a-zA-Z0-9_-]+$/.test(value.id)
    )
      return
    const reveal = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-checklist-id="${value!.id}"]`
      )
      if (!target) return false
      sessionStorage.removeItem("bordena:calendar:focus")
      target.scrollIntoView({ block: "center" })
      target.classList.add(
        "bg-primary/20",
        "rounded",
        "outline-2",
        "outline-primary"
      )
      return true
    }
    if (reveal()) return
    const observer = new MutationObserver(() => {
      if (reveal()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = setTimeout(() => observer.disconnect(), 3000)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [cardId, body])
  const renderers = useMemo(
    () => ({
      renderImage: (key: string, alt: string) => (
        <CardAttachmentImage cardId={cardId} attachmentKey={key} alt={alt} />
      ),
      renderWikilink: (target: string, alias?: string) => (
        <CardRefLink displayId={target} alias={alias} />
      ),
      onTagClick: toggleTagFilter,
      renderLink: (url: string, children: ReactNode[]) =>
        /^#bordena-task=[a-zA-Z0-9_-]{1,128}$/.test(url) ? (
          <span data-checklist-id={url.split("=")[1]}>{children}</span>
        ) : /^bordena:\/\/event\/[a-zA-Z0-9_-]{1,128}$/.test(url) ? (
          <button
            className="text-primary underline focus-visible:outline-2"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/calendar?event=${url.split("/").at(-1)}`)
            }}
          >
            {children}
          </button>
        ) : parseInlineDate(url) ? (
          <InlineDateLink
            key={url}
            cardId={cardId}
            url={url}
            body={body}
            onChangeBody={onChangeBody}
          >
            {children}
          </InlineDateLink>
        ) : undefined,
    }),
    [cardId, toggleTagFilter, body, onChangeBody]
  )

  return (
    <MarkdownRenderersProvider value={renderers}>
      {children}
    </MarkdownRenderersProvider>
  )
}
