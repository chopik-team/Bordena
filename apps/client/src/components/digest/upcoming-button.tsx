import { CalendarClock } from "lucide-react"
import { useT } from "@bordena/i18n"
import { SidebarMenuButton, SidebarMenuItem } from "@bordena/ui-kit"
import { useLocation, useRouter } from "wouter"
import { routes } from "@/lib/routes"
/** Sidebar entry that opens the digest of deadlined cards. */
export function UpcomingButton() {
  const t = useT()
  const [, navigate] = useLocation()
  // Nested route, so the match is on the router base rather than the location.
  const isActive = useRouter().base === routes.digest()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={t("Предстоящие")}
        onClick={() => navigate(`~${routes.digest()}`)}
      >
        <CalendarClock className="size-4" />
        <span>{t("Предстоящие")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
