import {
  memo,
  useState,
  type DetailedHTMLProps,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import { useLocation } from "wouter"
import type {
  BoardLayout,
  CardPatch,
  Card as CardData,
  Column,
} from "@bordena/core"
import { routes } from "@/lib/routes"
import { useIsRevealed } from "@/providers/card-reveal/card-reveal-context"
import { HistoryModal } from "../history/history-modal"
import { CardAttachments } from "./attachments/card-attachments"
import { CardAttachmentImage } from "./attachments/card-attachment-image"
import { CardContextMenu, CardMenu } from "./menu/card-menu"
import { CardMarkdown } from "./card-markdown"
import { CardView } from "./card-view"
import { useT } from "@bordena/i18n"
import { useDashboards } from "@bordena/core"
import { Zap } from "lucide-react"
import { ColumnColorPicker } from "../column/column-color"
import { Button } from "@bordena/ui-kit"

interface IProps extends DetailedHTMLProps<
  HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> {
  card: CardData
  layout?: BoardLayout
  column: Column
  showBody: boolean
  isDragging: boolean
  onPatch: (id: string, patch: CardPatch) => void
  lead?: ReactNode
  metaLead?: ReactNode
  imageCard?: boolean
  presentationProgress?: number | null
}

export const Card = memo(function Card({
  card,
  column,
  showBody,
  isDragging,
  onPatch,
  lead,
  metaLead,
  imageCard,
  presentationProgress,
  ...props
}: IProps) {
  const t = useT()
  const [, navigate] = useLocation()
  const id = card.id
  const isRevealed = useIsRevealed(id)
  const [historyOpen, setHistoryOpen] = useState(false)

  const open = () => navigate(routes.card.to(id))
  const showHistory = () => setHistoryOpen(true)

  return (
    <CardMarkdown cardId={id}>
      <CardView
        {...props}
        onKeyDown={(event) => {
          props.onKeyDown?.(event)
          // Keyboard focus belongs to the outer drag surface. Route its
          // context command to this card, rather than the enclosing section.
          if (
            event.target === event.currentTarget &&
            !event.defaultPrevented &&
            (event.key === "ContextMenu" ||
              (event.shiftKey && event.key === "F10"))
          ) {
            const trigger = event.currentTarget.querySelector<HTMLElement>(
              '[data-slot="context-menu-trigger"]'
            )
            if (trigger) {
              event.preventDefault()
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              trigger.dispatchEvent(
                new MouseEvent("contextmenu", {
                  bubbles: true,
                  cancelable: true,
                  button: 2,
                  clientX: rect.left + Math.min(24, rect.width / 2),
                  clientY: rect.top + Math.min(24, rect.height / 2),
                })
              )
            }
          }
        }}
        wrapCard={(inner) => (
          <CardContextMenu
            cardId={id}
            onEdit={open}
            onShowHistory={showHistory}
          >
            {inner}
          </CardContextMenu>
        )}
        card={card}
        colorControl={
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ColumnColorPicker
              label={t("Цвет карточки")}
              color={card.color ?? ""}
              onChange={(color) => onPatch(id, { color })}
            />
          </span>
        }
        presentationProgress={
          card.boardLink && card.boardLink.mode !== "navigation"
            ? (card.linkedProgress?.value ?? null)
            : presentationProgress
        }
        column={column}
        showBody={showBody}
        isDragging={isDragging}
        isRevealed={isRevealed}
        lead={lead}
        metaLead={
          metaLead || card.boardLink || card.automationRules?.length ? (
            <>
              {metaLead}
              {card.boardLink && <BoardLinkBadge card={card} />}{" "}
              {!!card.automationRules?.length && (
                <AutomationBadge card={card} onOpen={open} />
              )}
            </>
          ) : undefined
        }
        imageCard={imageCard}
        action={
          <CardMenu cardId={id} onEdit={open} onShowHistory={showHistory} />
        }
        onChangeBody={(body) => onPatch(id, { body })}
        onChangeDeadline={(deadline) => onPatch(id, { deadline })}
        onChangePriority={(priority) => onPatch(id, { priority })}
        attachments={
          <CardAttachments className="pt-2" cardId={id} isReadonly />
        }
        renderAttachmentImage={(key, alt, className) => (
          <CardAttachmentImage
            cardId={id}
            attachmentKey={key}
            alt={alt}
            className={className}
          />
        )}
      />
      <HistoryModal
        entityType="card"
        entityId={id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </CardMarkdown>
  )
})
/** Ordinary cards do not subscribe to the global board list just to render a badge. */
function BoardLinkBadge({ card }: { card: CardData }) {
  const t = useT(),
    { data: boards = [] } = useDashboards(),
    [, navigate] = useLocation()
  const board = boards.find((b) => b.id === card.boardLink!.boardId)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="max-w-full min-w-0 truncate"
      title={board?.title ?? t("Доска недоступна")}
      disabled={!board}
      onClick={(event) => {
        event.stopPropagation()
        navigate(`~/d/${card.boardLink!.boardId}`)
      }}
    >
      {board?.title ?? t("Доска недоступна")}
      {card.boardLink!.mode !== "navigation"
        ? ` · ${card.linkedProgress?.value == null ? "—" : `${card.linkedProgress.value}%`}`
        : ""}
    </Button>
  )
}

function AutomationBadge({
  card,
  onOpen,
}: {
  card: CardData
  onOpen: () => void
}) {
  const t = useT(),
    total = card.automationRules?.length ?? 0,
    active =
      card.automationRules?.filter((r) => r.enabled && !r.paused).length ?? 0
  const label = t("Автоматизация: включено правил {active} из {total}", {
    active,
    total,
  })
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-5 text-muted-foreground"
      title={label}
      aria-label={t("Автоматизация: включено правил {active} из {total}", {
        active,
        total,
      })}
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
    >
      <Zap className="size-3" />
    </Button>
  )
}
