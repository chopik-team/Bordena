import { useT } from "@bordena/i18n"
import { useState } from "react"
import { Button, Modal, ModalContent, ModalTitle } from "@bordena/ui-kit"
import {
  useOrganization,
  useOrganizationAction,
} from "@/lib/hooks/use-organization"
import { moveBoardGroup, workspaceList } from "@/lib/workspaces"
export function BoardGroupDialog({
  boardId,
  open,
  onOpenChange,
}: {
  boardId: string
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const t = useT()
  const { data } = useOrganization(),
    action = useOrganizationAction()
  const board = data?.dashboards.find((b) => b.id === boardId)
  const [selected, setSelected] = useState<string | null>(null),
    [folderChoice, setFolderId] = useState<string | null>(null)
  const workspaceId = selected ?? board?.workspaceId ?? "default"
  const folderId =
    folderChoice ??
    data?.sidebar.items.find(
      (item) => item.type === "folder" && item.boardIds.includes(boardId)
    )?.id ??
    ""
  const folders =
    data?.sidebar.items.filter(
      (i) => i.type === "folder" && (i.workspaceId ?? "default") === workspaceId
    ) ?? []
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="md:max-w-md">
        <ModalTitle>{t("Переместить доску")}</ModalTitle>
        <label className="mt-4 block text-sm">
          {t("Рабочее пространство")}
          <select
            aria-label={t("Пространство доски")}
            value={workspaceId}
            onChange={(e) => {
              setSelected(e.target.value)
              setFolderId("")
            }}
            className="mt-1 w-full rounded border bg-background p-2"
          >
            {workspaceList(data?.sidebar).map((w) => (
              <option value={w.id} key={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          {t("Проект или папка")}
          <select
            aria-label={t("Проект доски")}
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="mt-1 w-full rounded border bg-background p-2"
          >
            <option value="">{t("Без папки")}</option>
            {folders.map(
              (f) =>
                f.type === "folder" && (
                  <option value={f.id} key={f.id}>
                    {f.title}
                  </option>
                )
            )}
          </select>
        </label>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("Секции, карточки и файлы останутся на доске.")}
        </p>
        <Button
          className="mt-4"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(async () => {
              await moveBoardGroup(boardId, workspaceId, folderId || undefined)
              onOpenChange(false)
            })
          }
        >
          {t("Переместить")}
        </Button>
      </ModalContent>
    </Modal>
  )
}
