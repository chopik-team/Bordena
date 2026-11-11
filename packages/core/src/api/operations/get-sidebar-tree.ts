import type { Dashboard, SidebarItem } from "../../types"
import { db } from "../db/db"
import { getDashboards } from "./get-dashboards"
import { placeBoards } from "./sidebar-layout"

export type SidebarBoardNode = { type: "board"; dashboard: Dashboard }

export type SidebarFolderNode = {
  type: "folder"
  id: string
  title: string
  boards: Dashboard[]
  workspaceId?: string
  archived?: boolean
  deadline?: string | null
  priority?: "" | "low" | "medium" | "high"
  color?: string
}

export type SidebarNode = SidebarBoardNode | SidebarFolderNode

export function buildTree(
  items: SidebarItem[],
  dashboards: Dashboard[]
): SidebarNode[] {
  const byId = new Map(dashboards.map((d) => [d.id, d]))
  return placeBoards(items, dashboards).map((item) =>
    item.type === "board"
      ? { type: "board", dashboard: byId.get(item.id)! }
      : {
          type: "folder",
          id: item.id,
          title: item.title,
          boards: item.boardIds.map((id) => byId.get(id)!),
          ...(item.workspaceId ? { workspaceId: item.workspaceId } : {}),
          ...(item.archived !== undefined ? { archived: item.archived } : {}),
          ...(item.deadline !== undefined ? { deadline: item.deadline } : {}),
          ...(item.priority !== undefined ? { priority: item.priority } : {}),
          ...(item.color !== undefined ? { color: item.color } : {}),
        }
  )
}

export function treeItems(nodes: SidebarNode[]): SidebarItem[] {
  return nodes.map((node) =>
    node.type === "board"
      ? { type: "board", id: node.dashboard.id }
      : {
          type: "folder",
          id: node.id,
          title: node.title,
          boardIds: node.boards.map((d) => d.id),
          ...(node.workspaceId ? { workspaceId: node.workspaceId } : {}),
          ...(node.archived !== undefined ? { archived: node.archived } : {}),
          ...(node.deadline !== undefined ? { deadline: node.deadline } : {}),
          ...(node.priority !== undefined ? { priority: node.priority } : {}),
          ...(node.color !== undefined ? { color: node.color } : {}),
        }
  )
}

export function treeDashboards(nodes: SidebarNode[]): Dashboard[] {
  return nodes.flatMap((node) =>
    node.type === "board" ? [node.dashboard] : node.boards
  )
}

export async function getSidebarTree(): Promise<SidebarNode[]> {
  const [dashboards, layout] = await Promise.all([
    getDashboards(),
    db.getSidebarLayout(),
  ])
  return buildTree(layout.items, dashboards)
}
