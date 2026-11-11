import { cn, SidebarHeader } from "@bordena/ui-kit"
import { AppLogoMenu } from "../app-logo-menu"

export function AppSidebarHeader() {
  return (
    <SidebarHeader
      className={cn("mt-0.5 pt-[calc(--spacing(2)+env(safe-area-inset-top))]")}
    >
      <AppLogoMenu />
    </SidebarHeader>
  )
}
