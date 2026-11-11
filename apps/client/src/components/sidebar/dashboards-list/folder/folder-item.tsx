import { useT } from "@bordena/i18n"
import {
  Button,
  Modal,
  ModalContent,
  ModalTitle,
  SidebarMenuButton,
  cn,
  DateInput,
  formatDeadline,
} from "@bordena/ui-kit"
import { Folder, FolderOpen } from "lucide-react"
import {
  type SidebarFolderNode,
  setFolderCollapsed,
  useDeleteFolder,
  useRenameFolder,
} from "@bordena/core"
import { useCardDrop } from "@/providers/card-drop/card-drop-context"
import { FolderMenu } from "./folder-menu"
import { FolderTitleInput } from "./folder-title-input"
import { useEffect, useMemo, useState } from "react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  useOrganization,
  useOrganizationAction,
} from "@/lib/hooks/use-organization"
import { changeProject, workspaceList } from "@/lib/workspaces"
import { setPreferences } from "@/lib/preferences"
import { ColorSelect } from "@/components/column/column-color"
import { columnHue } from "@bordena/tokens"
import { useDeadlineClock } from "@/lib/hooks/use-deadline-clock"
import { deadlineInstant } from "@/lib/deadlines"
const OPEN_ON_HOVER_MS = 500
interface IProps {
  node: SidebarFolderNode
  collapsed: boolean
  renaming: boolean
  isDropTarget: boolean
  onRenameStart: () => void
  onRenameEnd: () => void
}
export function FolderItem({
  node,
  collapsed,
  renaming,
  isDropTarget,
  onRenameStart,
  onRenameEnd,
}: IProps) {
  const t = useT()
  const now = useDeadlineClock()
  const [properties, setProperties] = useState(false),
    [deadline, setDeadline] = useState(node.deadline ?? ""),
    [priority, setPriority] = useState(node.priority ?? ""),
    [color, setColor] = useState(node.color ?? "")
  const { mutate: rename } = useRenameFolder()
  const { mutate: remove } = useDeleteFolder()
  const [confirm, setConfirm] = useState(false),
    [moveOpen, setMoveOpen] = useState(false),
    [workspace, setWorkspace] = useState(node.workspaceId ?? "default")
  const { data: organization } = useOrganization(),
    action = useOrganizationAction()
  // A dragged card hovers a collapsed folder: it opens to offer its boards.
  const { target } = useCardDrop()
  const opensOnHover =
    target?.kind === "folder" && target.id === node.id && collapsed
  useEffect(() => {
    if (!opensOnHover) return
    const timer = setTimeout(
      () => setFolderCollapsed(node.id, false),
      OPEN_ON_HOVER_MS
    )
    return () => clearTimeout(timer)
  }, [opensOnHover, node.id])
  const FolderIcon = useMemo(() => {
    if (collapsed || isDropTarget) return Folder
    return FolderOpen
  }, [collapsed, isDropTarget])
  return (
    <>
      {renaming ? (
        <FolderTitleInput
          value={node.title}
          onCommit={(title) => rename({ id: node.id, title })}
          onDone={onRenameEnd}
        />
      ) : (
        <>
          <SidebarMenuButton
            tooltip={node.title}
            aria-expanded={!collapsed}
            onClick={() => setFolderCollapsed(node.id, !collapsed)}
            data-drop-folder={node.id}
            className={cn(
              "pr-8",
              opensOnHover &&
                "bg-sidebar-accent ring-2 ring-primary/60 ring-inset"
            )}
          >
            <FolderIcon
              style={
                node.color && columnHue(node.color) != null
                  ? { color: `oklch(0.65 0.14 ${columnHue(node.color)})` }
                  : undefined
              }
              className={cn(
                "size-3.5 text-muted-foreground",
                isDropTarget && "fill-current"
              )}
            />
            <span className="truncate">{node.title}</span>
            {node.priority === "high" && (
              <span className="text-amber-600" title={t("Высокий приоритет")}>
                !
              </span>
            )}
            {!node.archived &&
              node.deadline &&
              deadlineInstant(node.deadline) < now && (
                <span
                  className="size-2 shrink-0 rounded-full bg-destructive"
                  title={t("Просрочено")}
                />
              )}
          </SidebarMenuButton>
          <FolderMenu
            archived={node.archived}
            onMove={() => {
              setProperties(false)
              setWorkspace(node.workspaceId ?? "default")
              setMoveOpen(true)
            }}
            onProperties={() => {
              setDeadline(node.deadline ?? "")
              setPriority(node.priority ?? "")
              setColor(node.color ?? "")
              setProperties(true)
              setMoveOpen(true)
            }}
            onArchive={() =>
              action.mutate(() =>
                changeProject(node.id, { archived: !node.archived })
              )
            }
            onRename={onRenameStart}
            onDelete={() => setConfirm(true)}
          />
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("Удалить папку проекта?")}
        description={t(
          "Доски, секции, карточки и файлы сохранятся в рабочем пространстве."
        )}
        confirmLabel={t("Удалить папку")}
        onConfirm={() => remove(node.id)}
      />
      <Modal open={moveOpen} onOpenChange={setMoveOpen}>
        <ModalContent className="md:max-w-md">
          <ModalTitle>
            {t(properties ? "Параметры проекта" : "Переместить проект")}
          </ModalTitle>
          {properties ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {t("Срок проекта")}
                <DateInput
                  withTime
                  value={deadline || null}
                  onChange={(value) => setDeadline(value ?? "")}
                  inputProps={{ "aria-label": t("Срок проекта") }}
                  className="rounded border px-3 py-2 hover:bg-accent"
                >
                  {deadline ? formatDeadline(deadline) : t("Выбрать дату…")}
                </DateInput>
              </div>
              <label className="flex items-center justify-between gap-2">
                {t("Цвет проекта")}
                <ColorSelect
                  label={t("Цвет проекта")}
                  value={color}
                  onChange={setColor}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                {t("Приоритет")}
                <select
                  className="rounded border bg-background p-2"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as typeof priority)
                  }
                >
                  {["", "low", "medium", "high"].map((value) => (
                    <option key={value} value={value}>
                      {t(
                        value === "high"
                          ? "Высокий"
                          : value === "medium"
                            ? "Средний"
                            : value === "low"
                              ? "Низкий"
                              : "Без приоритета"
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(async () => {
                    await changeProject(node.id, {
                      deadline: deadline || null,
                      priority,
                      color,
                    })
                    setMoveOpen(false)
                  })
                }
              >
                {t("Сохранить")}
              </Button>
            </div>
          ) : (
            <>
              <label className="mt-4 block text-sm">
                {t("Рабочее пространство")}
                <select
                  aria-label={t("Новое пространство проекта")}
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="mt-1 w-full rounded border bg-background p-2"
                >
                  {workspaceList(organization?.sidebar).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("Все доски проекта переместятся вместе с ним.")}
              </p>
              <Button
                className="mt-4"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(async () => {
                    await changeProject(node.id, { workspaceId: workspace })
                    setPreferences({ workspaceId: workspace })
                    setMoveOpen(false)
                  })
                }
              >
                {t("Переместить")}
              </Button>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
