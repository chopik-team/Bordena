import { useT } from "@bordena/i18n"
import {
  SidebarMenuButton,
  cn,
  ContextMenu,
  ContextMenuTrigger,
  MenuContent,
  MenuItem,
} from "@bordena/ui-kit"
import { Globe, Users, Star, PanelsTopLeft } from "lucide-react"
import { toggleFavorite, useNavigation } from "@/lib/navigation"
import { useOrganizationAction } from "@/lib/hooks/use-organization"
import { updateDashboard } from "@/lib/layout-workspace"
import { BoardGroupDialog } from "@/components/navigation/board-group-dialog"
import { useMemo, useState } from "react"
import type { Dashboard } from "@bordena/core"
import { useCardDrop } from "@/providers/card-drop/card-drop-context"
import { useDashboardNav } from "@/lib/hooks"
import { columnHue } from "@bordena/tokens"
import { deadlineInstant } from "@/lib/deadlines"
import { useDeadlineClock } from "@/lib/hooks/use-deadline-clock"
interface IProps {
  dashboard: Dashboard
  isActive: boolean
  isPublished: boolean
  isShared: boolean
}
export function BoardItem({
  dashboard,
  isActive,
  isPublished,
  isShared,
}: IProps) {
  const t = useT()
  const [move, setMove] = useState(false)
  const organization = useOrganizationAction()
  const now = useDeadlineClock()
  const { selectDashboard } = useDashboardNav()
  const favorite = useNavigation().favorites.includes(dashboard.id)
  const { target } = useCardDrop()
  const isCardTarget = target?.kind === "board" && target.id === dashboard.id
  const marker = useMemo(() => {
    if (isPublished) return { Icon: Globe, label: "Public" }
    if (isShared) return { Icon: Users, label: "Shared" }
    return null
  }, [isPublished, isShared])
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="contents">
          <div className="bordena-board-nav-row group/board flex min-w-0 items-center">
            <SidebarMenuButton
              isActive={isActive}
              tooltip={dashboard.title}
              onClick={() => selectDashboard(dashboard.id)}
              data-drop-board={isActive ? undefined : dashboard.id}
              className={cn(
                "min-w-0 flex-1",
                isCardTarget &&
                  "bg-sidebar-accent ring-2 ring-primary/60 ring-inset"
              )}
            >
              {dashboard.color && columnHue(dashboard.color) != null ? (
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{
                    background: `oklch(0.72 0.14 ${columnHue(dashboard.color)})`,
                  }}
                />
              ) : (
                <PanelsTopLeft className="size-4 text-muted-foreground" />
              )}
              <span className="truncate">{dashboard.title}</span>
              {dashboard.priority === "high" && (
                <span
                  title={t("Высокий приоритет")}
                  className="font-bold text-amber-600"
                >
                  !
                </span>
              )}
              {dashboard.deadline &&
                deadlineInstant(dashboard.deadline) < now && (
                  <span
                    title={t("Просрочено")}
                    className="size-2 shrink-0 rounded-full bg-destructive"
                  />
                )}
              {marker && (
                <marker.Icon
                  role="img"
                  aria-label={marker.label}
                  className="ml-auto size-3.5 text-muted-foreground"
                />
              )}
            </SidebarMenuButton>
            <button
              type="button"
              className={cn(
                "bordena-favorite shrink-0 rounded p-2 text-muted-foreground hover:text-foreground focus-visible:outline-2",
                favorite && "is-favorite"
              )}
              aria-label={`${favorite ? t("Открепить") : t("В избранное")}: ${dashboard.title}`}
              aria-pressed={favorite}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                toggleFavorite(dashboard.id)
              }}
            >
              <Star className={cn("size-3.5", favorite && "fill-current")} />
            </button>
          </div>
        </ContextMenuTrigger>
        <MenuContent align="start">
          <MenuItem onClick={() => selectDashboard(dashboard.id)}>
            {t("Открыть")}
          </MenuItem>
          <MenuItem onClick={() => toggleFavorite(dashboard.id)}>
            {t(favorite ? "Открепить" : "В избранное")}
          </MenuItem>
          <MenuItem onClick={() => setMove(true)}>
            {t("Переместить доску")}
          </MenuItem>
          <MenuItem
            onClick={() =>
              organization.mutate(() =>
                updateDashboard(dashboard.id, (b) => ({
                  ...b,
                  archived: !b.archived,
                }))
              )
            }
          >
            {t(dashboard.archived ? "Вернуть из архива" : "Архивировать доску")}
          </MenuItem>
        </MenuContent>
      </ContextMenu>
      {move && (
        <BoardGroupDialog boardId={dashboard.id} open onOpenChange={setMove} />
      )}
    </>
  )
}
