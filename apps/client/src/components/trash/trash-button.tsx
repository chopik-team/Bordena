import { useT } from "@bordena/i18n"
import { SidebarMenuButton, SidebarMenuItem } from "@bordena/ui-kit"
import { useLocation } from "wouter"
import { routes } from "@/lib/routes"
/** Sidebar entry that opens the trash. */
export function TrashButton() {
  const t = useT()
  const [location, navigate] = useLocation()
  const isActive = location === routes.trash()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={t("Корзина")}
        onClick={() => navigate(`~${routes.trash()}`)}
      >
        <span>{t("Корзина")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
