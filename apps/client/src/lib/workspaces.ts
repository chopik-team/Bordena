import { t } from "@bordena/i18n"
import {
  DashboardSchema,
  SidebarLayoutSchema,
  type Dashboard,
  type SidebarLayout,
} from "@bordena/contract"
import { buildTree, newId, stamp, type SidebarNode } from "@bordena/core"
import { webDb } from "./adapters/web-db"
import { protectModelChanges } from "./layout-workspace"
export interface Organization {
  dashboards: Dashboard[]
  sidebar: SidebarLayout
}
export const DEFAULT_WORKSPACE = "default"
export function workspaceList(sidebar?: SidebarLayout): {
  id: string
  title: string
  archived?: boolean
}[] {
  return sidebar?.workspaces?.length
    ? sidebar.workspaces
    : [{ id: DEFAULT_WORKSPACE, title: t("Личное пространство") }]
}
export function scopedTree(
  nodes: SidebarNode[],
  workspaceId: string,
  archived: boolean
): SidebarNode[] {
  const visible = (board: Dashboard) =>
    (board.workspaceId ?? DEFAULT_WORKSPACE) === workspaceId &&
    (archived || !board.archived)
  return nodes.flatMap<SidebarNode>((node) =>
    node.type === "board"
      ? visible(node.dashboard)
        ? [node]
        : []
      : (node.workspaceId ?? DEFAULT_WORKSPACE) === workspaceId &&
          (archived || !node.archived)
        ? [{ ...node, boards: node.boards.filter(visible) }]
        : []
  )
}
export function placeBoardInGroup(
  state: Organization,
  boardId: string,
  workspaceId: string,
  folderId?: string
): Organization {
  if (!workspaceList(state.sidebar).some((w) => w.id === workspaceId))
    throw new Error(t("Рабочее пространство недоступно"))
  if (!state.dashboards.some((b) => b.id === boardId && !b.deletedAt))
    throw new Error(t("Доска недоступна"))
  const folder = state.sidebar.items.find(
    (i) => i.type === "folder" && i.id === folderId
  )
  if (
    folderId &&
    (!folder ||
      (folder.type === "folder" &&
        (folder.workspaceId ?? DEFAULT_WORKSPACE) !== workspaceId))
  )
    throw new Error(t("Папка недоступна в выбранном пространстве"))
  const items = state.sidebar.items.flatMap<SidebarLayout["items"][number]>(
    (item) =>
      item.type === "board"
        ? item.id === boardId
          ? []
          : [item]
        : [{ ...item, boardIds: item.boardIds.filter((id) => id !== boardId) }]
  )
  if (folderId) {
    const destination = items.find(
      (i) => i.type === "folder" && i.id === folderId
    )
    if (destination?.type === "folder") destination.boardIds.push(boardId)
  } else items.push({ type: "board", id: boardId })
  return {
    dashboards: state.dashboards.map((board) =>
      board.id === boardId ? { ...board, workspaceId } : board
    ),
    sidebar: { ...state.sidebar, items },
  }
}
async function editOrganization(
  edit: (state: Organization) => Organization
): Promise<void> {
  await protectModelChanges()
  await webDb.writeLocked(async () => {
    const db = await webDb.open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["dashboards", "sidebar"], "readwrite", {
        durability: "strict",
      })
      const boards = tx.objectStore("dashboards"),
        navigation = tx.objectStore("sidebar"),
        boardRequest = boards.getAll(),
        sidebarRequest = navigation.get("layout")
      let ready = 0,
        failure: unknown
      const apply = () => {
        if (++ready < 2) return
        try {
          const current: Organization = {
            dashboards: boardRequest.result,
            sidebar: sidebarRequest.result ?? {
              id: "layout",
              items: [],
              updatedAt: 0,
              deletedAt: null,
            },
          }
          const next = edit(current),
            at = stamp()
          const sidebar = SidebarLayoutSchema.parse({
            ...next.sidebar,
            updatedAt: at,
          })
          const spaces = workspaceList(sidebar)
          if (new Set(spaces.map((w) => w.id)).size !== spaces.length)
            throw new Error(t("Повтор рабочего пространства"))
          navigation.put(sidebar, "layout")
          for (const board of next.dashboards) {
            const previous = current.dashboards.find((b) => b.id === board.id)
            if (JSON.stringify(previous) !== JSON.stringify(board))
              boards.put(
                DashboardSchema.parse({ ...board, updatedAt: at }),
                board.id
              )
          }
        } catch (error) {
          failure = error
          tx.abort()
        }
      }
      boardRequest.onsuccess = sidebarRequest.onsuccess = apply
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () =>
        reject(
          failure ??
            tx.error ??
            new Error(t("Не удалось сохранить организацию досок"))
        )
    })
  })
}
export async function readOrganization(): Promise<Organization> {
  return {
    dashboards: await webDb.getAll<Dashboard>("dashboards"),
    sidebar: (await webDb.get<SidebarLayout>("sidebar", "layout")) ?? {
      id: "layout",
      items: [],
      updatedAt: 0,
      deletedAt: null,
    },
  }
}
export async function createWorkspace(title: string): Promise<string> {
  const id = newId("workspace")
  await editOrganization((state) => ({
    ...state,
    sidebar: {
      ...state.sidebar,
      workspaces: [
        ...workspaceList(state.sidebar),
        { id, title: title.trim() || t("Новое пространство") },
      ],
    },
  }))
  return id
}
export function renameWorkspace(id: string, title: string): Promise<void> {
  return editOrganization((state) => ({
    ...state,
    sidebar: {
      ...state.sidebar,
      workspaces: workspaceList(state.sidebar).map((w) =>
        w.id === id ? { ...w, title: title.trim() || w.title } : w
      ),
    },
  }))
}
export function archiveWorkspace(id: string, archived: boolean): Promise<void> {
  return editOrganization((state) => ({
    ...state,
    sidebar: {
      ...state.sidebar,
      workspaces: workspaceList(state.sidebar).map((space) =>
        space.id === id ? { ...space, archived } : space
      ),
    },
  }))
}
/** Removing an organization container always retains every project, board and file. */
export function removeWorkspace(
  id: string,
  destination: string
): Promise<void> {
  return editOrganization((state) => {
    const spaces = workspaceList(state.sidebar)
    if (
      id === destination ||
      !spaces.some((space) => space.id === id) ||
      !spaces.some((space) => space.id === destination)
    )
      throw new Error(t("Рабочее пространство недоступно"))
    return {
      dashboards: state.dashboards.map((board) =>
        (board.workspaceId ?? DEFAULT_WORKSPACE) === id
          ? { ...board, workspaceId: destination }
          : board
      ),
      sidebar: {
        ...state.sidebar,
        workspaces: spaces.filter((space) => space.id !== id),
        items: state.sidebar.items.map((item) =>
          item.type === "folder" &&
          (item.workspaceId ?? DEFAULT_WORKSPACE) === id
            ? { ...item, workspaceId: destination }
            : item
        ),
      },
    }
  })
}
export async function createProject(
  title: string,
  workspaceId: string
): Promise<string> {
  const id = newId("folder")
  await editOrganization((state) => {
    if (!workspaceList(state.sidebar).some((w) => w.id === workspaceId))
      throw new Error(t("Рабочее пространство недоступно"))
    return {
      ...state,
      sidebar: {
        ...state.sidebar,
        items: [
          {
            type: "folder",
            id,
            title: title.trim() || t("Новый проект"),
            workspaceId,
            boardIds: [],
          },
          ...state.sidebar.items,
        ],
      },
    }
  })
  return id
}
export function moveBoardGroup(
  boardId: string,
  workspaceId: string,
  folderId?: string
): Promise<void> {
  return editOrganization((state) =>
    placeBoardInGroup(state, boardId, workspaceId, folderId)
  )
}
export function changeProject(
  id: string,
  patch: {
    workspaceId?: string
    archived?: boolean
    deadline?: string | null
    priority?: "" | "low" | "medium" | "high"
    color?: string
  }
): Promise<void> {
  return editOrganization((state) => {
    const folder = state.sidebar.items.find(
      (i) => i.type === "folder" && i.id === id
    )
    if (folder?.type !== "folder") throw new Error(t("Проект недоступен"))
    if (
      patch.workspaceId &&
      !workspaceList(state.sidebar).some((w) => w.id === patch.workspaceId)
    )
      throw new Error(t("Рабочее пространство недоступно"))
    return {
      dashboards: patch.workspaceId
        ? state.dashboards.map((board) =>
            folder.boardIds.includes(board.id)
              ? { ...board, workspaceId: patch.workspaceId }
              : board
          )
        : state.dashboards,
      sidebar: {
        ...state.sidebar,
        items: state.sidebar.items.map((item) =>
          item.id === id ? { ...item, ...patch } : item
        ),
      },
    }
  })
}
/** Convert filtered root indexes back to the complete existing sidebar before its DnD mutation. */
export function scopedRootIndex(
  nodes: SidebarNode[],
  visible: SidebarNode[],
  id: string,
  index: number
): number {
  const key = (node: SidebarNode) =>
    node.type === "folder" ? node.id : node.dashboard.id
  const all = nodes.filter((node) => key(node) !== id),
    scoped = visible.filter((node) => key(node) !== id)
  const after = scoped[index]
  if (after)
    return Math.max(
      0,
      all.findIndex((node) => key(node) === key(after))
    )
  const last = scoped.at(-1)
  return last
    ? all.findIndex((node) => key(node) === key(last)) + 1
    : all.length
}
export { buildTree }
