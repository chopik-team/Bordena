import { db } from "../db/db"
import { sync } from "../sync"
import { stamp } from "../sync/hlc"

function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i])
}

/** Sets a board's card ordering: sort keys in order, empty for manual. */
export async function setDashboardSort(
  id: string,
  sort: string[]
): Promise<void> {
  const dashboard = await db.getDashboard(id)
  if (!dashboard || sameKeys(dashboard.sort ?? [], sort)) return
  await db.setDashboard({ ...dashboard, sort, updatedAt: stamp() })
  sync.markDirty("dashboards", id)
}
