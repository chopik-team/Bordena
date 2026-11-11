import { useEffect, useRef, useState } from "react"
import { cn } from "./lib/cn"

interface IProps {
  value: string
  onCommit: (next: string) => void
  /** Accessible name for the edit input. */
  label: string
  /** Extra classes applied to both display and edit states, so sizing and
   *  typography stay identical as the field flips between them. */
  className?: string
  placeholder?: string
  /** Hint shown on the display element. */
  title?: string
  /** Commit an empty value instead of reverting to the previous one. */
  allowEmpty?: boolean
  autoEdit?: boolean
  activation?: "click" | "doubleClick"
  emptyMessage?: string
  onEditingEnd?: () => void
}

/**
 * A value that flips to an inline input on click and commits on blur/Enter
 * (Escape cancels). Owns its editing state and a local draft, so a committed
 * edit shows immediately instead of flashing the stale `value` while the
 * mutation round-trips. Shared by titles and the attachment name.
 */
export function InvisibleInput({
  value,
  onCommit,
  label,
  className,
  placeholder,
  title = "Click to edit",
  allowEmpty = false,
  autoEdit = false,
  activation = "click",
  emptyMessage,
  onEditingEnd,
}: IProps) {
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Adopt external changes (a refetch, or another client's edit) only when
  // `value` genuinely changes — never on our own commit, where it's still
  // stale — and not while a draft is being typed.
  const [lastValue, setLastValue] = useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    if (!editing) setDraft(value)
  }

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startEditing() {
    setError(false)
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    const next = draft.trim()
    if (!next && !allowEmpty && emptyMessage) {
      setError(true)
      inputRef.current?.focus()
      return
    }
    if (next !== value && (allowEmpty || next)) {
      setDraft(next)
      onCommit(next)
    } else {
      setDraft(value)
    }
    setEditing(false)
    onEditingEnd?.()
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
    onEditingEnd?.()
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") cancel()
        }}
        aria-label={label}
        aria-invalid={error || undefined}
        title={error ? emptyMessage : title}
        placeholder={error ? emptyMessage : placeholder}
        className={cn(
          className,
          "bg-transparent outline-none",
          "placeholder:text-muted-foreground",
          "rounded-sm bg-secondary px-2 py-0.5"
        )}
      />
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={activation === "click" ? startEditing : undefined}
      onDoubleClick={activation === "doubleClick" ? startEditing : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          startEditing()
        }
      }}
      title={title}
      className={cn("line-clamp-1 cursor-text px-2", className)}
    >
      {draft || <span className="text-muted-foreground/50">{placeholder}</span>}
    </button>
  )
}
