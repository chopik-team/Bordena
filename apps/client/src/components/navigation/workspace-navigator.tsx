import { useT } from "@bordena/i18n"
import { useState, useEffect } from "react"
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalContent,
  ModalTitle,
} from "@bordena/ui-kit"
import { ChevronDown, MoreHorizontal } from "lucide-react"
import { usePreferences, setPreferences } from "@/lib/preferences"
import {
  useOrganization,
  useOrganizationAction,
} from "@/lib/hooks/use-organization"
import {
  createWorkspace,
  renameWorkspace,
  createProject,
  workspaceList,
  archiveWorkspace,
  removeWorkspace,
} from "@/lib/workspaces"
import { ConfirmDialog } from "../confirm-dialog"
import { useLocation } from "wouter"
import { changeNavigation } from "@/lib/navigation"
export function WorkspaceNavigator({
  controllerOnly = false,
}: {
  controllerOnly?: boolean
}) {
  const t = useT()
  const preferences = usePreferences(),
    { data } = useOrganization(),
    action = useOrganizationAction()
  const [, navigate] = useLocation()
  const selectSpace = (id: string) => {
    setPreferences({ workspaceId: id })
    changeNavigation((s) => ({ ...s, active: null }))
    navigate("~/")
  }
  const allSpaces = workspaceList(data?.sidebar),
    visibleSpaces = allSpaces.filter(
      (space) =>
        preferences.showArchived ||
        !space.archived ||
        space.id === preferences.workspaceId
    ),
    spaces = visibleSpaces.length ? visibleSpaces : [allSpaces[0]],
    active = spaces.find((w) => w.id === preferences.workspaceId) ?? spaces[0]
  const destination = allSpaces.find(
    (space) => space.id !== active.id && !space.archived
  )
  const [removeOpen, setRemoveOpen] = useState(false)
  const [dialog, setDialog] = useState<"create" | "rename" | "project" | null>(
      null
    ),
    [name, setName] = useState("")
  const title =
    dialog === "rename"
      ? t("Переименовать пространство")
      : dialog === "project"
        ? t("Новый проект или папка")
        : t("Новое рабочее пространство")
  const open = (kind: typeof dialog) => {
    setName(kind === "rename" ? active.title : "")
    setDialog(kind)
  }
  useEffect(() => {
    if (!controllerOnly) return
    const create = () => {
      setName("")
      setDialog("create")
    }
    window.addEventListener("bordena:create-workspace", create)
    return () => window.removeEventListener("bordena:create-workspace", create)
  }, [controllerOnly])
  return (
    <div
      className={
        controllerOnly ? "contents" : "bordena-workspaces space-y-1 px-2"
      }
    >
      {!controllerOnly && (
        <>
          <p className="bordena-sidebar-caption">{t("Рабочие пространства")}</p>
          <div className="flex min-w-0 items-center gap-1">
            <div className="relative min-w-0 flex-1">
              <select
                aria-label={t("Рабочее пространство")}
                title={active.title}
                className="w-full min-w-0 appearance-none truncate rounded-md border bg-sidebar py-2 pr-8 pl-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                value={active.id}
                onChange={(e) => selectSpace(e.target.value)}
              >
                {spaces.map((space) => (
                  <option value={space.id} key={space.id}>
                    {space.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("Действия с пространством")}
                  />
                }
              >
                <MoreHorizontal />
              </MenuTrigger>
              <MenuContent>
                <MenuItem onClick={() => open("create")}>
                  {t("Новое рабочее пространство")}
                </MenuItem>
                <MenuItem onClick={() => open("project")}>
                  {t("Новый проект или папка")}
                </MenuItem>
                <MenuItem onClick={() => open("rename")}>
                  {t("Переименовать пространство")}
                </MenuItem>
                {destination && (
                  <MenuItem
                    onClick={() =>
                      action.mutate(async () => {
                        await archiveWorkspace(active.id, !active.archived)
                        if (!active.archived) selectSpace(destination.id)
                      })
                    }
                  >
                    {active.archived
                      ? t("Вернуть из архива")
                      : t("Архивировать пространство")}
                  </MenuItem>
                )}
                {destination && (
                  <MenuItem
                    variant="destructive"
                    onClick={() => setRemoveOpen(true)}
                  >
                    {t("Удалить пространство")}
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() =>
                    setPreferences({ showArchived: !preferences.showArchived })
                  }
                >
                  {preferences.showArchived
                    ? t("Скрыть архив")
                    : t("Показать архив")}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </>
      )}
      <Modal
        open={dialog !== null}
        onOpenChange={(value) => {
          if (!value && !action.isPending) setDialog(null)
        }}
      >
        <ModalContent className="md:max-w-md">
          <ModalTitle>{title}</ModalTitle>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              action.mutate(async () => {
                if (dialog === "create") {
                  const id = await createWorkspace(name)
                  selectSpace(id)
                } else if (dialog === "rename")
                  await renameWorkspace(active.id, name)
                else await createProject(name, active.id)
                setDialog(null)
              })
            }}
          >
            <label className="block text-sm">
              {t("Название")}
              <input
                autoFocus
                required
                maxLength={4096}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background p-2"
              />
            </label>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? t("Сохранение…") : t("Сохранить")}
            </Button>
          </form>
        </ModalContent>
      </Modal>
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t("Удалить пространство?")}
        description={t(
          "Проекты и доски будут перенесены в «{title}». Карточки и файлы сохранятся.",
          { title: destination?.title ?? "" }
        )}
        onConfirm={() => {
          if (destination)
            action.mutate(async () => {
              await removeWorkspace(active.id, destination.id)
              selectSpace(destination.id)
            })
        }}
      />
    </div>
  )
}
