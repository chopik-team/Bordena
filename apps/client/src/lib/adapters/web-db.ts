import { t } from "@bordena/i18n"
import { IDB } from "@bordena/client-db"
import {
  CardSchema,
  type Card,
  type Column,
  type Dashboard,
} from "@bordena/contract"
import { validateLinks, validateFieldValues } from "@bordena/core"
import {
  CARDS_BY_COLUMN,
  CARDS_BY_DEADLINE,
  CARDS_BY_NUMBER,
  HISTORY,
  HISTORY_BY_CREATED,
  HISTORY_BY_ENTITY,
  META_STORE,
  STORES,
} from "@bordena/core"
export const DB_NAME = "bordena"
const VERSION = 15
export const BLOBS = "bordena-blobs"
export const BACKUPS = "bordena-backups"
export const DATA_LOCK = "bordena-data-write"
export interface DataWrite {
  store: string
  key: string
  before?: unknown
  after?: unknown
  source?: "command" | "synchronization"
}
const writeListeners = new Set<(write: DataWrite) => void>()
export function subscribeDataWrites(
  listener: (write: DataWrite) => void
): () => void {
  writeListeners.add(listener)
  return () => {
    writeListeners.delete(listener)
  }
}
export function notifyDataWrite(write: DataWrite): void {
  for (const listener of writeListeners) listener(write)
}
export class BordenaDB extends IDB {
  private boundEpoch: number | undefined
  async bindEpoch(): Promise<void> {
    this.boundEpoch =
      (await super.get<number>(META_STORE, "bordena:epoch")) ?? 0
  }
  private async checkEpoch(): Promise<void> {
    const current = (await super.get<number>(META_STORE, "bordena:epoch")) ?? 0
    if (this.boundEpoch === undefined) this.boundEpoch = current
    if (this.boundEpoch !== current)
      throw new Error(
        t(
          "Данные восстановлены в другом окне. Перезапустите окно перед редактированием"
        )
      )
  }
  upgrade(db: IDBDatabase, tx: IDBTransaction) {
    for (const store of STORES) {
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
    }
    if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS)
    if (!db.objectStoreNames.contains(BACKUPS)) db.createObjectStore(BACKUPS)
    // The meta store persists across upgrades — only create it if missing.
    if (!db.objectStoreNames.contains(META_STORE))
      db.createObjectStore(META_STORE)
    // Add the column index to the (possibly pre-existing) cards store. The
    // versionchange `tx` is how we reach a store that wasn't just created.
    const cards = tx.objectStore("cards")
    if (!cards.indexNames.contains(CARDS_BY_COLUMN))
      cards.createIndex(CARDS_BY_COLUMN, "columnId")
    if (!cards.indexNames.contains(CARDS_BY_DEADLINE))
      cards.createIndex(CARDS_BY_DEADLINE, "deadline")
    if (!cards.indexNames.contains(CARDS_BY_NUMBER))
      cards.createIndex(CARDS_BY_NUMBER, "number")
    const history = tx.objectStore(HISTORY)
    if (!history.indexNames.contains(HISTORY_BY_ENTITY))
      history.createIndex(HISTORY_BY_ENTITY, "entityId")
    if (!history.indexNames.contains(HISTORY_BY_CREATED))
      history.createIndex(HISTORY_BY_CREATED, "createdAt")
  }
  // The same lock protects normal edits and backup/import across all windows.
  writeLocked<T>(action: () => Promise<T>): Promise<T> {
    return withDataLock(async () => {
      await this.checkEpoch()
      return action()
    })
  }
  update<T>(
    storeName: string,
    key: string,
    transform: (current: T | undefined) => T | undefined
  ): Promise<T | undefined> {
    return this.writeLocked(async () => {
      if (["cards", "columns", "dashboards", "sidebar"].includes(storeName))
        await (
          await import("../exchange/workspace")
        ).ensureModelCheckpointLocked()
      const database = await this.open()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(
          storeName === "cards"
            ? ["cards", "columns", "dashboards"]
            : storeName,
          "readwrite",
          {
            durability: "strict",
          }
        )
        const store = tx.objectStore(storeName),
          request = store.get(key)
        let result: T | undefined, before: T | undefined, failure: unknown
        request.onsuccess = () => {
          try {
            before = request.result as T | undefined
            result = transform(before)
            if (result !== undefined) {
              if (storeName !== "cards") {
                store.put(result, key)
                return
              }
              const card = result as Card,
                previous = before as Card | undefined
              const changed = (field: keyof Card) =>
                JSON.stringify(previous?.[field]) !==
                JSON.stringify(card[field])
              const references =
                changed("boardLink") ||
                (changed("columnId") &&
                  !!(previous?.boardLink || card.boardLink))
              const properties =
                changed("stageId") ||
                changed("stateId") ||
                changed("fieldValues") ||
                (changed("columnId") && !!card.fieldValues)
              if ((!references && !properties) || card.deletedAt) {
                store.put(result, key)
                return
              }
              const cards = tx.objectStore("cards").getAll(),
                columns = tx.objectStore("columns").getAll(),
                boards = tx.objectStore("dashboards").getAll()
              let remaining = 3
              const validate = () => {
                if (--remaining) return
                try {
                  const parsed = CardSchema.parse(card),
                    cols = columns.result as Column[],
                    dashboards = boards.result as Dashboard[]
                  const parent = cols.find(
                      (c) => c.id === parsed.columnId && !c.deletedAt
                    ),
                    board = dashboards.find(
                      (b) => b.id === parent?.dashboardId && !b.deletedAt
                    )
                  if (!parent || !board) throw new Error(t("Доска недоступна"))
                  if (
                    board.layout &&
                    ((parsed.stageId &&
                      !board.layout.stages.some(
                        (s) => s.id === parsed.stageId
                      )) ||
                      (parsed.stateId &&
                        !board.layout.states.some(
                          (s) => s.id === parsed.stateId
                        )))
                  )
                    throw new Error(t("Неверный этап или состояние карточки"))
                  validateFieldValues(parsed, board.fieldDefinitions ?? [])
                  if (references)
                    validateLinks({
                      dashboards,
                      columns: cols,
                      cards: (cards.result as Card[]).map((c) =>
                        c.id === key ? parsed : c
                      ),
                    })
                  result = parsed as T
                  store.put(result, key)
                } catch (error) {
                  failure = error
                  tx.abort()
                }
              }
              cards.onsuccess = columns.onsuccess = boards.onsuccess = validate
            }
          } catch (error) {
            failure = error
            tx.abort()
          }
        }
        tx.oncomplete = () => {
          notifyDataWrite({ store: storeName, key, before, after: result })
          resolve(result)
        }
        tx.onerror = tx.onabort = () =>
          reject(failure ?? tx.error ?? new Error(t("Ошибка записи данных")))
      })
    })
  }
  override set(store: string, key: string, value: unknown): Promise<void> {
    return withDataLock(async () => {
      await this.checkEpoch()
      if (["cards", "columns", "dashboards", "sidebar"].includes(store))
        await (
          await import("../exchange/workspace")
        ).ensureModelCheckpointLocked()
      const before = ["cards", "columns", "dashboards"].includes(store)
        ? await super.get(store, key)
        : undefined
      const candidate = value as Card
      if (store === "cards" && candidate.boardLink && !candidate.deletedAt) {
        const [dashboards, columns, cards] = await Promise.all([
          super.getAll<Dashboard>("dashboards"),
          super.getAll<Column>("columns"),
          super.getAll<Card>("cards"),
        ])
        validateLinks({
          dashboards,
          columns,
          cards: [...cards.filter((c) => c.id !== key), candidate],
        })
      }
      await super.set(store, key, value)
      notifyDataWrite({ store, key, before, after: value })
    })
  }
  override delete(store: string, key: string): Promise<void> {
    return withDataLock(async () => {
      await this.checkEpoch()
      await super.delete(store, key)
      notifyDataWrite({ store, key })
    })
  }
  override clear(store: string): Promise<void> {
    return withDataLock(async () => {
      await this.checkEpoch()
      await super.clear(store)
      notifyDataWrite({ store, key: "*" })
    })
  }
}
let lockGeneration = 0
export function currentDataGeneration(): number {
  return lockGeneration
}
export function withDataLock<T>(action: () => Promise<T>): Promise<T> {
  if (!globalThis.navigator?.locks)
    throw new Error(t("Хранилище требует браузер с поддержкой Web Locks"))
  return navigator.locks.request(DATA_LOCK, async () => {
    // A cheap persisted generation prevents a delayed BroadcastChannel message
    // from allowing another window to plan against a stale in-memory snapshot.
    lockGeneration =
      ((await webDb.get<number>("meta", "bordena:lock-generation")) ?? 0) + 1
    await webDb.run("meta", "readwrite", (store) =>
      store.put(lockGeneration, "bordena:lock-generation")
    )
    return action()
  })
}
export const webDb = new BordenaDB(DB_NAME, VERSION)
