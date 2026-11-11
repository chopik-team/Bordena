import { useT } from "@bordena/i18n"
import {
  useCreateCard,
  useCreateColumn,
  useDeleteColumn,
  useDeleteDashboard,
  useMoveCard,
  useMoveCardToBoard,
  useSaveCard,
  useMoveColumn,
  useRenameColumn,
  useRenameDashboard,
  useSetColumnCollapsed,
  useSetColumnColor,
  useSetColumnDone,
  useSetDashboardSort,
  type CardPatch,
  useBoard,
  setBoardView,
  useBoardView,
  type Dashboard,
  sectionProgressValues,
} from "@bordena/core"
import { useCallback, useMemo, useEffect } from "react"
import { useLocation } from "wouter"
import { useDragEnd, useSyncShortcut } from "@/lib/hooks"
import { routes } from "@/lib/routes"
import { unlinkDeletedBoard } from "@/lib/vault/use-vault"
import { useDeck } from "@/providers/deck/deck-context"
import { requestLinkedSync } from "@/lib/linked-sync"
import { Deck } from "./deck"
/**
 * Connects the open board to its data: loads it, wires the card/dashboard
 * mutations and drag-reorder, and renders the presentational {@link Deck}.
 */
export function DeckView({ dashboard }: { dashboard: Dashboard }) {
  const t = useT()
  const id = dashboard.id
  useEffect(() => {
    requestLinkedSync(id)
  }, [id])
  const [, navigate] = useLocation()
  // ⌘S / Ctrl+S flushes a sync immediately
  useSyncShortcut()
  const { mutate: setColumnCollapsed } = useSetColumnCollapsed(id)
  const { mutate: setColumnColor } = useSetColumnColor(id)
  const { mutate: setColumnDone } = useSetColumnDone(id)
  const { mutate: renameDashboard } = useRenameDashboard()
  const { mutate: deleteDashboard } = useDeleteDashboard()
  const { mutate: setDashboardSort } = useSetDashboardSort()
  const { data: board, isPending } = useBoard(id)
  const progressValues = useMemo(
    () => sectionProgressValues(board?.cards ?? [], dashboard.layout),
    [board?.cards, dashboard.layout]
  )
  const progressOf = useCallback(
    (card: import("@bordena/core").Card) => progressValues.get(card.id) ?? null,
    [progressValues]
  )
  const view = useBoardView(id, dashboard.goalPath ? "goal" : "board")
  const { mutate: createCard } = useCreateCard(id)
  const { mutate: moveCard } = useMoveCard(id)
  const { mutate: moveCardToBoard } = useMoveCardToBoard(id)
  const { mutate: createColumn } = useCreateColumn(id)
  const { mutate: moveColumn } = useMoveColumn(id)
  const { mutate: renameColumn } = useRenameColumn(id)
  const { mutate: deleteColumn } = useDeleteColumn(id)
  const { mutate: saveCard } = useSaveCard()
  const patchCard = useCallback(
    (cardId: string, patch: CardPatch) => saveCard({ id: cardId, patch }),
    [saveCard]
  )
  const { tagFilters, userFilters } = useDeck()
  const handleDragEnd = useDragEnd(
    board,
    moveCard,
    dashboard.sort ?? [],
    tagFilters,
    userFilters,
    progressOf,
    (columnId) => dashboard.layout?.sections[columnId]?.progressMode ?? "off"
  )
  return (
    <Deck
      progressOf={progressOf}
      dashboard={dashboard}
      board={board ?? { columns: [], cards: [] }}
      isLoading={isPending}
      onToggleBody={(columnId, collapsed) =>
        setColumnCollapsed({ id: columnId, collapsed })
      }
      onAddCard={createCard}
      onAddAndOpenCard={(columnId) =>
        createCard(columnId, {
          onSuccess: (cardId) => navigate(routes.card.to(cardId)),
        })
      }
      onAddColumn={() => createColumn(t("Новая колонка"))}
      onReorderColumns={moveColumn}
      onChangeColumnColor={(columnId, color) =>
        setColumnColor({ id: columnId, color })
      }
      onChangeColumnDone={(columnId, done) =>
        setColumnDone({ id: columnId, done })
      }
      onRenameColumn={(columnId, title) =>
        renameColumn({ id: columnId, title })
      }
      onDeleteColumn={deleteColumn}
      onRenameDashboard={(name) => renameDashboard({ id, name })}
      onDeleteDashboard={() => {
        unlinkDeletedBoard(id)
        deleteDashboard(id)
      }}
      onChangeSort={(sort) => setDashboardSort({ id, sort })}
      view={view}
      onChangeView={(next) => setBoardView(id, next)}
      onDragEnd={handleDragEnd}
      onMoveCardToBoard={moveCardToBoard}
      onPatchCard={patchCard}
      onMatrixMove={moveCard}
      onMatrixAdd={(stageId, stateId) => {
        const first = board?.columns[0]
        if (first)
          createCard(first.id, {
            onSuccess: (cardId) =>
              saveCard({ id: cardId, patch: { stageId, stateId } }),
          })
        else
          createColumn(t("Карточки"), {
            onSuccess: (columnId) =>
              createCard(columnId, {
                onSuccess: (cardId) =>
                  saveCard({ id: cardId, patch: { stageId, stateId } }),
              }),
          })
      }}
    />
  )
}
