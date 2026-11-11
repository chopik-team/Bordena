import { useT } from "@bordena/i18n"
import type {
  DroppableProvidedProps,
  DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd"
import { createElement, type ReactNode, type Ref } from "react"
import { toast } from "react-hot-toast"
import { Button, cn } from "@bordena/ui-kit"
import { Check, FoldVertical, Plus, UnfoldVertical } from "lucide-react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ColumnSwatch } from "./column-swatch"
import { ColumnColorPicker } from "./column-color"
import { columnHue } from "@bordena/tokens"
import { ColumnTitle } from "./column-title"
import { AddCardBlockedToast } from "@/components/toasts/add-card-blocked/add-card-blocked-toast"
interface IProps {
  title: string
  color: string
  done: boolean
  showBody: boolean
  onToggleBody: () => void
  /** Omit to make the title fixed text. */
  onRename?: (title: string) => void
  /** The column menu, where the viewer can act on the column. */
  menu?: ReactNode
  /** Omit to drop the add-card button. */
  onAddCard?: () => void
  addCardDisabledReason?: string
  /** Drag state and wiring, supplied by the board's `Droppable`. */
  isDraggingOver?: boolean
  listRef?: Ref<HTMLDivElement>
  listProps?: DroppableProvidedProps
  children: ReactNode
  sectionCollapsed?: boolean
  tint?: boolean
  leading?: ReactNode
  onToggleSection?: () => void
  autoRename?: boolean
  headerDragProps?: DraggableProvidedDragHandleProps | null
  onChangeColor?: (color: string) => void
}
/** A column: its head, then the box holding its cards. */
export function ColumnView({
  title,
  color,
  done,
  showBody,
  onToggleBody,
  onRename,
  menu,
  onAddCard,
  addCardDisabledReason,
  isDraggingOver,
  listRef,
  listProps,
  children,
  sectionCollapsed,
  tint,
  leading,
  onToggleSection,
  autoRename,
  headerDragProps,
  onChangeColor,
}: IProps) {
  const t = useT()
  return (
    <div
      role="group"
      aria-label={title}
      className={cn(
        "bordena-section flex w-full shrink-0 snap-center flex-col overscroll-y-contain pb-4 xs:w-sm",
        onToggleSection ? "overflow-visible" : "overflow-y-auto"
      )}
      style={
        tint && columnHue(color) != null
          ? { backgroundColor: `oklch(0.7 0.1 ${columnHue(color)} / 0.05)` }
          : undefined
      }
    >
      <div
        {...headerDragProps}
        aria-label={
          headerDragProps
            ? t("Переместить секцию: {p0}", { p0: title })
            : undefined
        }
        style={
          columnHue(color) != null
            ? {
                backgroundColor: tint
                  ? `oklch(0.7 0.13 ${columnHue(color)} / 0.13)`
                  : undefined,
                borderTop: `2px solid oklch(0.65 0.13 ${columnHue(color)} / 0.6)`,
              }
            : undefined
        }
        className={cn(
          "sticky top-0 z-10 flex h-13 shrink-0 items-center justify-between gap-2 px-4 py-3 md:px-0",
          "bg-background/80 backdrop-blur-xs",
          "text-muted-foreground",
          headerDragProps &&
            "cursor-grab focus-visible:outline-2 active:cursor-grabbing"
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {leading}
          {onChangeColor ? (
            <ColumnColorPicker color={color} onChange={onChangeColor} />
          ) : (
            <ColumnSwatch color={color} labelled className="ml-1" />
          )}
          <div className="min-w-0">
            <ColumnTitle
              title={title}
              onRename={onRename}
              autoRename={autoRename}
            />
            {/* The only place the flag shows — its toggle lives in the menu. */}
            {!!done && (
              <div className="absolute -mt-1 ml-2 text-xs text-muted-foreground">
                {t("Отмечает карточки выполненными")}{" "}
              </div>
            )}
          </div>
          {done && (
            <Check
              aria-label={t("{p0} — выполненные карточки", { p0: title })}
              className="-ml-2 size-4 shrink-0"
            />
          )}
        </div>
        <div className="flex items-center">
          {onToggleSection && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("{p0} секцию: {p1}", {
                p0: sectionCollapsed ? t("Развернуть") : t("Свернуть"),
                p1: title,
              })}
              aria-expanded={!sectionCollapsed}
              onClick={onToggleSection}
            >
              {sectionCollapsed ? <ChevronRight /> : <ChevronDown />}
            </Button>
          )}
          {!onToggleSection && (
            <Button
              variant="ghost"
              size="icon-lg"
              aria-pressed={showBody}
              aria-label={
                showBody
                  ? t("Скрыть заметки: {p0}", { p0: title })
                  : t("Показать заметки: {p0}", { p0: title })
              }
              onClick={onToggleBody}
            >
              {showBody ? <FoldVertical /> : <UnfoldVertical />}
            </Button>
          )}
          {menu}
        </div>
      </div>
      <div
        hidden={sectionCollapsed}
        style={sectionCollapsed ? { display: "none" } : undefined}
        className={cn(
          "flex min-h-20 w-full shrink-0 flex-col rounded-xl bg-background p-4 transition-colors",
          "border border-sidebar-primary-foreground",
          isDraggingOver && "bg-primary/5 dark:bg-sidebar/50"
        )}
      >
        <div ref={listRef} {...listProps} className="flex flex-1 flex-col">
          {children}
        </div>
        {onAddCard && (
          <Button
            variant="muted"
            onClick={() => {
              if (!addCardDisabledReason) return onAddCard()
              toast.custom(
                (toastInstance) =>
                  createElement(AddCardBlockedToast, {
                    visible: toastInstance.visible,
                    reason: addCardDisabledReason,
                  }),
                { id: "add-card-blocked", duration: 2500 }
              )
            }}
            aria-disabled={!!addCardDisabledReason}
            aria-label={t("Добавить карточку: {p0}", { p0: title })}
            className={cn("mb-3 w-full", addCardDisabledReason && "opacity-50")}
            tooltip={addCardDisabledReason ?? false}
          >
            <Plus /> {t("Добавить карточку")}
          </Button>
        )}
      </div>
    </div>
  )
}
