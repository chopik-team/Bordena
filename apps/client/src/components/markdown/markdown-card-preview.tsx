import { useT } from "@bordena/i18n"
import { useState } from "react"
import { toggleTaskByIndex } from "@bordena/markdown"
import { Markdown } from "@bordena/ui-kit"
interface IProps {
  /** The card body already reduced to the visible portion (before the cut). */
  preview: string
  /** The full, unreduced body — task toggles operate on this. */
  body: string
  /** Whether content was hidden by the cut marker, showing an "open to see more" hint. */
  hasMore: boolean
  /** Called with the new body when a task-list checkbox is toggled. */
  onChangeBody?: (body: string) => void
  compact?: boolean
}
/**
 * Renders a board card's body
 */
export function MarkdownCardPreview({
  preview,
  body,
  hasMore,
  onChangeBody,
  compact = false,
}: IProps) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const bounded =
    compact && (preview.length > 240 || preview.split("\n").length > 5)
  if (!preview && !hasMore) return null
  return (
    <>
      <div
        className="bordena-note-preview"
        data-bounded={bounded || undefined}
        data-expanded={expanded || undefined}
        tabIndex={bounded && !expanded ? 0 : undefined}
        aria-label={bounded ? t("Предпросмотр заметки") : undefined}
      >
        {preview && (
          <Markdown
            onToggleTask={
              onChangeBody
                ? (index) => onChangeBody(toggleTaskByIndex(body, index))
                : undefined
            }
            className="preview text-foreground/90"
          >
            {preview}
          </Markdown>
        )}
      </div>
      {bounded && (
        <button
          type="button"
          aria-expanded={expanded}
          className="bordena-preview-toggle text-xs font-semibold text-primary"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          {t(expanded ? "Свернуть заметку" : "Развернуть заметку")}
        </button>
      )}
      {hasMore && (
        <span className="text-sm text-muted-foreground select-none">
          {t("Открыть полностью")}{" "}
        </span>
      )}
    </>
  )
}
