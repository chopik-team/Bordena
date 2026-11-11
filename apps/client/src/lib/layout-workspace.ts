import { t } from "@bordena/i18n"
import { DashboardSchema, type Dashboard } from "@bordena/contract"
import {
  initialLayout,
  validateLayout,
  stamp,
  type BoardLayout,
  type LayoutMode,
} from "@bordena/core"
import { webDb } from "./adapters/web-db"
import { createBackup, ensureModelCheckpointLocked } from "./exchange/workspace"
export async function protectModelChanges(): Promise<void> {
  await webDb.writeLocked(ensureModelCheckpointLocked)
}
/** Read and update the latest record inside one strict transaction, under the shared write lock. */
export async function updateDashboard(
  id: string,
  update: (board: Dashboard) => Dashboard
): Promise<void> {
  await protectModelChanges()
  await webDb.update<Dashboard>("dashboards", id, (board) => {
    if (!board || board.deletedAt)
      throw new Error(t("Доска удалена или недоступна"))
    const next = DashboardSchema.parse({
      ...update(board),
      id,
      updatedAt: stamp(),
    })
    if (next.layout) validateLayout(next.layout)
    return next
  })
}
export async function ensureLayout(
  id: string,
  mode: LayoutMode
): Promise<void> {
  // Keep a verified pre-change workspace copy. No cards or old columns are rewritten.
  await createBackup("automatic", "Смена компоновки")
  const columns = (
    await webDb.getAll<import("@bordena/core").Column>("columns")
  ).filter((c) => c.dashboardId === id && !c.deletedAt)
  await updateDashboard(id, (board) => ({
    ...board,
    layout: board.layout
      ? { ...board.layout, mode }
      : initialLayout(columns, mode),
  }))
}
export function changeLayout(
  id: string,
  update: (layout: BoardLayout) => BoardLayout
): Promise<void> {
  return updateDashboard(id, (board) => {
    if (!board.layout) throw new Error(t("Сначала выберите компоновку"))
    return { ...board, layout: update(board.layout) }
  })
}
