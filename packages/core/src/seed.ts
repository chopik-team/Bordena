import type { Card, Column, Dashboard } from "./types"
// Product startup data is supplied atomically by the Bordena host.
export const cards: Card[] = []
export const seedColumns: Column[] = []
export const seedDashboards: Dashboard[] = []
export const fallbackCard: Card = {
  id: "1",
  columnId: "1",
  position: "a0",
  number: null,
  deadline: null,
  priority: "",
  tags: [],
  users: [],
  attachments: [],
  stamps: {},
  bodyConflict: null,
  updatedAt: 0,
  deletedAt: null,
  title: "Без названия",
  body: "",
}
/** Templates every newly created board starts with. */
export const BOARD_COLUMNS: Column[] = [
  {
    id: "todo",
    title: "К выполнению",
    position: "a0",
    dashboardId: "",
    collapsed: false,
    done: false,
    stamps: {},
    color: "",
    updatedAt: 0,
    deletedAt: null,
  },
  {
    id: "doing",
    title: "В работе",
    position: "a1",
    dashboardId: "",
    collapsed: false,
    done: false,
    stamps: {},
    color: "",
    updatedAt: 0,
    deletedAt: null,
  },
  {
    id: "done",
    title: "Готово",
    position: "a2",
    dashboardId: "",
    collapsed: false,
    done: false,
    stamps: {},
    color: "",
    updatedAt: 0,
    deletedAt: null,
  },
]
