import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { Compartment, EditorState, type Extension } from "@codemirror/state"
import { EditorView, keymap, placeholder } from "@codemirror/view"
import type { RefObject } from "react"
import {
  DEFAULT_SLASH_COMMANDS,
  type PrefixOption,
  type SlashCommand,
  type WikilinkOption,
} from "@bordena/markdown"
import {
  completions,
  prefixCompletion,
  slashCompletion,
  wikilinkCompletion,
} from "./completions"
import { decorations, wikilinkTargets } from "./decorations"
import { markdownSyntax } from "./language"
import { pasteFiles } from "./paste-files"
import { theme } from "./theme"

export interface EditorOptions {
  value: string
  onChangeValue: (value: string) => void
  autoFocus?: boolean
  placeholder?: string
  /** Off for a plain field as the title. */
  markdown?: boolean
  slashMenu?: boolean
  slashCommands?: SlashCommand[]
  wikilinks?: WikilinkOption[]
  suggestions?: Record<string, PrefixOption[]>
  onPasteFiles?: (files: File[]) => Promise<string | null>
  onSelectionMenu?: (selection: TextSelectionAction) => void
}
export interface TextSelectionAction {
  text: string
  link?: string
  dateLink?: string
  eventLink?: string
  task?: { id?: string; text: string; replace: (id: string) => boolean }
  replace: (markdown: string) => boolean
}

/** Right-click preserves a selection, otherwise targets the clicked word or caret. */
export function textContextSelection(
  view: EditorView,
  position?: number
): TextSelectionAction {
  const selection = view.state.selection.main
  let from = selection.from,
    to = selection.to
  if (
    position !== undefined &&
    (selection.empty || position < from || position > to)
  ) {
    const word = view.state.wordAt(position)
    from = word?.from ?? position
    to = word?.to ?? position
  }
  const original = view.state.doc.toString()
  const line = view.state.doc.lineAt(from)
  const task = /^(\s*[-*+]\s+\[[ xX]\]\s+)(.+)$/.exec(line.text)
  const anchored = task
    ? /^\[(.*)\]\(#bordena-task=([a-zA-Z0-9_-]+)\)$/.exec(task[2])
    : null
  const date = [
    ...original.matchAll(/\[((?:\\.|[^\\\]])*)\]\((#bordena-date=[^\s)]+)\)/g),
  ].find((match) => match.index <= from && match.index + match[0].length >= to)
  const calendarEvent = [
    ...original.matchAll(
      /\[((?:\\.|[^\\\]])*)\]\((bordena:\/\/event\/[a-zA-Z0-9_-]{1,128})\)/g
    ),
  ].find((match) => match.index <= from && match.index + match[0].length >= to)
  if (date) {
    from = date.index
    to = date.index + date[0].length
  } else if (calendarEvent) {
    from = calendarEvent.index
    to = calendarEvent.index + calendarEvent[0].length
  }
  const text = date
    ? date[1].replace(/\\([\\[\]])/g, "$1")
    : calendarEvent
      ? calendarEvent[1].replace(/\\([\\[\]])/g, "$1")
      : view.state.doc.sliceString(from, to)
  const link = [
    ...original.matchAll(
      /\[[^\]]*\]\((bordena:\/\/(?:board|card)\/[a-zA-Z0-9_-]+)\)/g
    ),
  ].find(
    (match) => match.index <= from && match.index + match[0].length >= to
  )?.[1]
  return {
    text,
    link,
    dateLink: date?.[2],
    eventLink: calendarEvent?.[2],
    task:
      task &&
      [...original.slice(0, line.from).matchAll(/^\s*(?:```|~~~)/gm)].length %
        2 ===
        0
        ? {
            id: anchored?.[2],
            text: anchored?.[1] ?? task[2],
            replace: (id) => {
              if (
                view.state.doc.toString() !== original ||
                !/^[a-zA-Z0-9_-]{1,128}$/.test(id)
              )
                return false
              view.dispatch({
                changes: {
                  from: line.from,
                  to: line.to,
                  insert: `${task[1]}[${anchored?.[1] ?? task[2]}](#bordena-task=${id})`,
                },
                userEvent: "input",
              })
              return true
            },
          }
        : undefined,
    replace: (markdown) => {
      if (view.state.doc.toString() !== original) return false
      view.dispatch({
        changes: { from, to, insert: markdown },
        selection: { anchor: from + markdown.length },
        userEvent: "input",
      })
      view.focus()
      return true
    },
  }
}

const BRACKETS = ["(", "[", "{", "`"]

export function editorExtensions(
  live: RefObject<EditorOptions>,
  targets: Compartment,
  labels: Compartment
): Extension {
  const {
    markdown,
    slashMenu,
    wikilinks,
    suggestions,
    placeholder: placeholderText,
  } = live.current

  const sources = []
  if (slashMenu)
    sources.push(
      slashCompletion(
        () => live.current.slashCommands ?? DEFAULT_SLASH_COMMANDS
      )
    )
  if (wikilinks)
    sources.push(wikilinkCompletion(() => live.current.wikilinks ?? []))
  for (const prefix of Object.keys(suggestions ?? {}))
    sources.push(
      prefixCompletion(prefix, () => live.current.suggestions?.[prefix] ?? [])
    )

  const markdownExtensions: Extension = markdown
    ? [
        markdownSyntax(),
        decorations(),
        targets.of(wikilinkTargets.of(new Set())),
        closeBrackets(),
        keymap.of(closeBracketsKeymap),
        EditorState.languageData.of(() => [
          { closeBrackets: { brackets: BRACKETS } },
        ]),
        sources.length > 0 ? completions(sources) : [],
        pasteFiles((files) =>
          live.current.onPasteFiles
            ? live.current.onPasteFiles(files)
            : Promise.resolve(null)
        ),
      ]
    : []

  return [
    history(),
    markdownExtensions,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    theme,
    labels.of(editorLabels(placeholderText)),
    EditorView.updateListener.of((update) => {
      if (update.docChanged)
        live.current.onChangeValue(update.state.doc.toString())
    }),
  ]
}
/** Reconfigure labels without replacing the document, selection or undo history. */
export function editorLabels(text?: string): Extension {
  return [
    placeholder(text ?? ""),
    EditorView.contentAttributes.of({
      "aria-label": text ?? "",
      autocorrect: "off",
      autocapitalize: "off",
      spellcheck: "false",
    }),
  ]
}
