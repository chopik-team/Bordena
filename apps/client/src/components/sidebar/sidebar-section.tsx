import type { ReactNode } from "react"
import { useUiFlag } from "@/lib/ui-state"
export function SidebarSection({
  id,
  title,
  children,
  closed = false,
  action,
}: {
  id: string
  title: string
  children: ReactNode
  closed?: boolean
  action?: ReactNode
}) {
  const [collapsed, setCollapsed] = useUiFlag("collapsed:" + id, closed)
  return (
    <div className="relative">
      <details
        open={!collapsed}
        onToggle={(e) => setCollapsed(!e.currentTarget.open)}
        className="bordena-sidebar-section"
      >
        <summary
          className={`mx-2 cursor-pointer rounded-md px-2 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent ${action ? "pr-10" : ""}`}
        >
          {title}
        </summary>
        {children}
      </details>
      {action && <div className="absolute top-0 right-1">{action}</div>}
    </div>
  )
}
