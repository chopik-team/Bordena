import { SidebarTrigger, cn, useSidebar } from "@bordena/ui-kit"
import type { ReactNode } from "react"
import { hasOverlayTitleBar } from "@/lib/platform"
import { useIsFullscreen } from "@/lib/hooks"
import { FocusExit } from "../navigation/presentation-controls"

interface IProps {
  className?: string
  children?: ReactNode
}

/** Top bar of a page: the sidebar toggle, then whatever the page puts beside it. */
export function PageHeader({ className, children }: IProps) {
  const { isMobile, open } = useSidebar()
  const isFullscreen = useIsFullscreen()
  // An open sidebar covers the window's top-left corner and pads itself for the
  // traffic lights; collapsed or on a sheet, the header has to clear them.
  const windowControlsInset =
    hasOverlayTitleBar() && !isFullscreen && (isMobile || !open)

  return (
    <header
      className={cn(
        "flex min-h-11.5 shrink-0 items-center gap-2 border-b px-4",
        "pt-[env(safe-area-inset-top)]",
        windowControlsInset && "pl-24",
        className
      )}
    >
      <SidebarTrigger />
      <FocusExit />
      {children}
    </header>
  )
}
