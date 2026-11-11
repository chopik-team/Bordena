import { useUiFlag } from "@/lib/ui-state"
import { useParams, useLocation } from "wouter"
import { useEffect } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  useSidebar,
} from "@bordena/ui-kit"
import { BoardShortcuts } from "../navigation/board-navigation"
import { WorkspaceNavigator } from "../navigation/workspace-navigator"
import { AppSidebarHeader } from "./app-sidebar-header"
import { DashboardsList } from "./dashboards-list/dashboards-list"
import { TrashButton } from "@/components/trash/trash-button"
import { HistoryButton } from "@/components/history/history-button"
import { UpcomingButton } from "@/components/digest/upcoming-button"
import { SidebarSection } from "./sidebar-section"
import { usePreferences, setPreferences } from "@/lib/preferences"
import { useT } from "@bordena/i18n"
import { CalendarNavigation } from "../calendar/calendar-navigation"

export function AppSidebar() {
  const t = useT(),
    preferences = usePreferences()
  const activeDashboardId = useParams().id ?? ""
  const [focus] = useUiFlag("focus")
  const [path] = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [path, isMobile, setOpenMobile, focus])

  return (
    <Sidebar className="ml-1">
      <AppSidebarHeader />
      <SidebarContent className="bordena-sidebar-content group/sidebar">
        <SidebarGroup className="bordena-sidebar-main">
          <BoardShortcuts />
          <CalendarNavigation part="primary" />
          <SidebarMenu>
            <UpcomingButton />
          </SidebarMenu>
        </SidebarGroup>
        <WorkspaceNavigator />
        <DashboardsList
          activeDashboardId={activeDashboardId}
          sharedIds={[]}
          publishedIds={[]}
        />

        <SidebarSection id="more" title={t("Дополнительно")} closed>
          <BoardShortcuts onlyRecent />
          <TrashButton />
          <HistoryButton />
          <button
            className="mx-3 rounded p-2 text-sm"
            onClick={() =>
              setPreferences({ showArchived: !preferences.showArchived })
            }
          >
            {t(preferences.showArchived ? "Скрыть архив" : "Показать архив")}
          </button>
        </SidebarSection>
      </SidebarContent>
    </Sidebar>
  )
}
