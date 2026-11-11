import { useT } from "@bordena/i18n"
import { useState, useEffect, type ReactNode } from "react"
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  ContextMenu,
  ContextMenuTrigger,
} from "@bordena/ui-kit"
import { ArrowRightLeft, History, MoreHorizontal, Trash2 } from "lucide-react"
import { useDashboards } from "@bordena/core"
import { useOrganizationAction } from "@/lib/hooks/use-organization"
import { updateDashboard } from "@/lib/layout-workspace"
import { BoardGroupDialog } from "@/components/navigation/board-group-dialog"
import { ConfirmDialog } from "../../confirm-dialog"
import { HistoryModal } from "../../history/history-modal"
import { ReorderColumnsModal } from "../reorder-columns/reorder-columns-modal"
import { SortSub } from "./sort-sub"
import type { Column } from "@bordena/core"
import { BoardTools } from "../board-tools"
import { LayoutControls } from "../layout-controls"
import { VaultButton } from "./vault-button"
import { openAppSettings } from "@/lib/app-settings"
import { PresentationItems } from "@/components/navigation/presentation-controls"
interface IProps {
  boardId: string
  title: string
  columns: Column[]
  sort: string[]
  onChangeSort: (sort: string[]) => void
  onDelete: () => void
  onReorderColumns: (changed: Column[]) => void
  children?: ReactNode
  onDateList?: () => void
}
export function BoardActionsMenu({
  boardId,
  children,
  title,
  columns,
  sort,
  onChangeSort,
  onDelete,
  onReorderColumns,
  onDateList,
}: IProps) {
  const t = useT()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [panel, setPanel] = useState<
    "board" | "fields" | "layout" | "vault" | null
  >(null)
  const { data: dashboards = [] } = useDashboards()
  const dashboard = dashboards.find((d) => d.id === boardId)
  const organization = useOrganizationAction()
  useEffect(() => {
    if (children) return
    const show = (e: Event) => {
      if ((e as CustomEvent<string>).detail === boardId) setPanel("layout")
    }
    window.addEventListener("bordena:board-layout", show)
    return () => window.removeEventListener("bordena:board-layout", show)
  }, [boardId, children])
  const items = (
    <>
      <PresentationItems />
      <MenuItem onClick={() => setPanel("board")}>
        {t("Параметры доски")}
      </MenuItem>
      <MenuItem onClick={() => setPanel("layout")}>{t("Компоновка…")}</MenuItem>
      <MenuItem onClick={() => setPanel("fields")}>
        {t("Шаблоны и поля")}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={onDateList}>{t("Лента по датам")}</MenuItem>
      <MenuItem onClick={() => setGroupOpen(true)}>
        {t("Переместить доску")}
      </MenuItem>
      <MenuItem
        onClick={() =>
          organization.mutate(() =>
            updateDashboard(boardId, (b) => ({
              ...b,
              archived: !b.archived,
            }))
          )
        }
      >
        {dashboard?.archived ? t("Вернуть из архива") : t("Архивировать доску")}
      </MenuItem>
      <SortSub sort={sort} onChangeSort={onChangeSort} />
      {!dashboard?.layout && (
        <MenuItem
          onClick={() => setReorderOpen(true)}
          disabled={columns.length < 2}
        >
          <ArrowRightLeft />
          {t("Порядок колонок")}{" "}
        </MenuItem>
      )}
      <MenuItem onClick={() => setHistoryOpen(true)}>
        <History />
        {t("История")}{" "}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => setPanel("vault")}>{t("Папка доски")}</MenuItem>
      <MenuItem onClick={() => openAppSettings("data")}>
        {t("Импорт, экспорт и резервные копии")}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => setConfirmOpen(true)} variant="destructive">
        <Trash2 />
        {t("Удалить доску")}{" "}
      </MenuItem>
    </>
  )
  return (
    <>
      {children ? (
        <ContextMenu>
          <ContextMenuTrigger className="contents">
            {children}
          </ContextMenuTrigger>
          <MenuContent align="start">{items}</MenuContent>
        </ContextMenu>
      ) : (
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("Действия с доской")}
                className="text-muted-foreground"
                tooltip={false}
              />
            }
          >
            <MoreHorizontal />
          </MenuTrigger>
          <MenuContent>{items}</MenuContent>
        </Menu>
      )}
      {dashboard && (panel === "board" || panel === "fields") && (
        <BoardTools
          dashboard={dashboard}
          open
          onOpenChange={(v) => !v && setPanel(null)}
          dialogOnly
          initialSection={panel === "fields" ? "fields" : undefined}
        />
      )}
      {dashboard && panel === "layout" && (
        <LayoutControls
          dashboard={dashboard}
          open
          onOpenChange={(v) => !v && setPanel(null)}
          dialogOnly
        />
      )}
      {panel === "vault" && (
        <VaultButton
          boardId={boardId}
          dialogOnly
          onClose={() => setPanel(null)}
        />
      )}
      {groupOpen && (
        <BoardGroupDialog boardId={boardId} open onOpenChange={setGroupOpen} />
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Удалить доску?")}
        description={t(
          "Доска «{title}» со всеми секциями и карточками переместится в корзину на 14 дней.",
          { title }
        )}
        confirmLabel={t("Удалить доску")}
        onConfirm={onDelete}
      />
      <ReorderColumnsModal
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        columns={columns}
        onReorder={onReorderColumns}
      />
      <HistoryModal
        entityType="board"
        entityId={boardId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  )
}
