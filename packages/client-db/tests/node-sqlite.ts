import { DatabaseSync } from "node:sqlite"
import type { SQLiteDriver } from "../src/adapters/sqlite-db"

/** `node:sqlite` in place of `expo-sqlite`, so the adapter runs off-device. */
export function openNodeDatabase(name: string): SQLiteDriver {
  const db = new DatabaseSync(name)
  const bind = (params: (string | number)[]) => params as never[]
  return {
    execSync: (sql) => db.exec(sql),
    execAsync: async (sql) => db.exec(sql),
    getAllSync: (sql, params) => db.prepare(sql).all(...bind(params)) as never,
    getAllAsync: async (sql, params) =>
      db.prepare(sql).all(...bind(params)) as never,
    getFirstAsync: async (sql, ...params) =>
      (db.prepare(sql).get(...bind(params)) ?? null) as never,
    runAsync: async (sql, ...params) => db.prepare(sql).run(...bind(params)),
  }
}
