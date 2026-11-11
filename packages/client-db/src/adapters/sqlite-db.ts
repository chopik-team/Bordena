import type { ClientDB, KeyRange, Query } from "../client-db"

export interface SQLiteDriver {
  execSync(sql: string): void
  execAsync(sql: string): Promise<void>
  getAllSync<T>(sql: string, params: (string | number)[]): T[]
  getAllAsync<T>(sql: string, params: (string | number)[]): Promise<T[]>
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number)[]
  ): Promise<T | null>
  runAsync(sql: string, ...params: (string | number)[]): Promise<unknown>
}

/**
 * Which JSON properties of a store's records carry a secondary index. The
 * property name doubles as the index name, because that is what the operations
 * layer passes as `Query.index` (see `CARDS_BY_COLUMN`).
 */
export type Schema = Record<string, readonly string[]>

interface Row {
  value: string
}

/** Identifiers come from the schema constants, never from a caller, so they are
 * interpolated rather than bound. */
function quote(identifier: string): string {
  return `"${identifier}"`
}

function bounds(column: string, range: KeyRange | undefined) {
  const clauses: string[] = []
  const params: (string | number)[] = []
  if (range?.lower !== undefined) {
    clauses.push(`${quote(column)} >${range.exclusive?.lower ? "" : "="} ?`)
    params.push(range.lower)
  }
  if (range?.upper !== undefined) {
    clauses.push(`${quote(column)} <${range.exclusive?.upper ? "" : "="} ?`)
    params.push(range.upper)
  }
  return { clauses, params }
}

/**
 * {@link ClientDB} over SQLite, the mobile counterpart to the web's `IDB`.
 *
 * Each store is a `(key, value)` table holding the record as JSON. A secondary
 * index is a virtual column reading that property back out via `json_extract`,
 * with a real SQL index over it — so a range seek stays a seek instead of
 * turning into a full-store scan and a JS filter.
 */
export class SQLiteDB implements ClientDB {
  name: string
  version: number
  private db: SQLiteDriver
  private schema: Schema

  constructor(
    name: string,
    version: number,
    schema: Schema,
    open: (name: string) => SQLiteDriver
  ) {
    this.name = name
    this.version = version
    this.schema = schema
    this.db = open(name)
    this.migrate()
  }

  /** Idempotent, and additive only — the same shape of upgrade the web adapter
   * does, where a store that already exists still has to be able to gain an
   * index it didn't have before. */
  private migrate(): void {
    for (const [store, indexes] of Object.entries(this.schema)) {
      this.db.execSync(
        `CREATE TABLE IF NOT EXISTS ${quote(store)} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
      )
      // `table_xinfo`, not `table_info`: the latter omits generated columns, so
      // every launch after the first would re-add one and fail on the duplicate.
      const columns = new Set(
        this.db
          .getAllSync<{ name: string }>(
            `PRAGMA table_xinfo(${quote(store)})`,
            []
          )
          .map((column) => column.name)
      )
      for (const index of indexes) {
        if (!columns.has(index)) {
          // No declared type: TEXT affinity would store a numeric property as
          // text, and a lookup by number would then match nothing.
          this.db.execSync(
            `ALTER TABLE ${quote(store)} ADD COLUMN ${quote(index)} ` +
              `GENERATED ALWAYS AS (json_extract(value, '$.${index}')) VIRTUAL`
          )
        }
        this.db.execSync(
          `CREATE INDEX IF NOT EXISTS ${quote(`${store}_${index}`)} ` +
            `ON ${quote(store)} (${quote(index)})`
        )
      }
    }
    this.db.execSync(`PRAGMA user_version = ${this.version}`)
  }

  async get<T>(store: string, key: string): Promise<T | undefined> {
    const row = await this.db.getFirstAsync<Row>(
      `SELECT value FROM ${quote(store)} WHERE key = ?`,
      key
    )
    return row ? (JSON.parse(row.value) as T) : undefined
  }

  async getAll<T>(store: string, query?: Query<T>): Promise<T[]> {
    const column = query?.index ?? "key"
    const { clauses, params } = bounds(column, query?.range)
    // An IndexedDB index holds no entry for a record whose indexed property is
    // absent or null, so a scan of one here must drop those rows too —
    // otherwise the deadline index starts answering "cards with no deadline".
    if (query?.index) clauses.push(`${quote(column)} IS NOT NULL`)
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""
    // Index key first, primary key breaking ties: an index cursor's order.
    const order = query?.index ? `${quote(column)}, key` : "key"
    // `filter` runs in JS after the fetch, so `count` can only be pushed down
    // into SQL when there isn't one.
    const pushDownCount = query?.count !== undefined && !query.filter
    const limit = pushDownCount ? ` LIMIT ${query.count}` : ""

    const rows = await this.db.getAllAsync<Row>(
      `SELECT value FROM ${quote(store)}${where} ORDER BY ${order}${limit}`,
      params
    )
    const values = rows.map((row) => JSON.parse(row.value) as T)
    if (!query?.filter) return values
    const filtered = values.filter(query.filter)
    return query.count === undefined ? filtered : filtered.slice(0, query.count)
  }

  async set(store: string, key: string, value: unknown): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO ${quote(store)} (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      JSON.stringify(value ?? null)
    )
  }

  async delete(store: string, key: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM ${quote(store)} WHERE key = ?`, key)
  }

  async count(store: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${quote(store)}`
    )
    return row?.n ?? 0
  }

  async keys(store: string, range?: KeyRange): Promise<string[]> {
    const { clauses, params } = bounds("key", range)
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""
    const rows = await this.db.getAllAsync<{ key: string }>(
      `SELECT key FROM ${quote(store)}${where} ORDER BY key`,
      params
    )
    return rows.map((row) => row.key)
  }

  async clear(store: string): Promise<void> {
    await this.db.execAsync(`DELETE FROM ${quote(store)}`)
  }
}
