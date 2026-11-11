import { cn, useIsMobile } from "@bordena/ui-kit"
import { SlashMenuFab } from "../slash-menu/slash-menu-fab"
import type { EditorOptions } from "./extensions"
import { useEditorView } from "./hooks/use-editor-view"
import { textContextSelection } from "./extensions"

interface IProps extends EditorOptions {
  className?: string
  containerClassName?: string
  overlayContainer?: HTMLElement | null
  /** Keeps typed `/` but drops the button, for hosts with their own toolbar. */
  hideSlashFab?: boolean
}

export function Editor({
  className,
  containerClassName,
  overlayContainer,
  hideSlashFab,
  ...options
}: IProps) {
  const isMobile = useIsMobile()
  const { containerRef, view } = useEditorView(options)

  function focusEnd(e: React.MouseEvent) {
    if (!view || view.contentDOM.contains(e.target as Node)) return
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    view.focus()
  }

  return (
    <div className={cn("relative flex w-full flex-col", containerClassName)}>
      <div
        ref={containerRef}
        onClick={focusEnd}
        onContextMenu={(event) => {
          if (!view || !options.onSelectionMenu) return
          event.preventDefault()
          const position =
            event.clientX || event.clientY
              ? (view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                undefined)
              : undefined
          options.onSelectionMenu(textContextSelection(view, position))
        }}
        onKeyDown={(event) => {
          if (
            !view ||
            !options.onSelectionMenu ||
            !(
              event.key === "ContextMenu" ||
              (event.shiftKey && event.key === "F10")
            )
          )
            return
          event.preventDefault()
          options.onSelectionMenu(
            textContextSelection(
              view,
              view.state.selection.main.empty
                ? view.state.selection.main.head
                : undefined
            )
          )
        }}
        className={cn(
          "flex w-full flex-col py-2 font-mono",
          "text-base leading-relaxed [font-variant-ligatures:none]",
          className
        )}
      />
      {options.slashMenu && isMobile && !hideSlashFab && (
        <SlashMenuFab
          view={view}
          commands={options.slashCommands}
          container={overlayContainer}
        />
      )}
    </div>
  )
}
