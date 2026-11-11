import { HybridClock } from "@bordena/sync"
import { runtime } from "../../runtime"
import { META_STORE } from "../constants"

const LAST_KEY = "hlc:last"

export const clock = new HybridClock()

/**
 * Mirrored in the KV store as well as the DB because DB writes are async: a
 * mobile browser can evict the app before one lands, and a clock that comes
 * back regressed issues timestamps below ones it already handed out, which lose
 * LWW and vanish silently. The DB is the backstop for when the KV is cleared.
 */
function readLocal(): number {
  const raw = Number(runtime().kv.get(LAST_KEY))
  return Number.isFinite(raw) ? raw : 0
}

function writeLocal(ts: number): void {
  runtime().kv.set(LAST_KEY, String(ts))
}

/** Folds in the persisted high-water mark so the clock stays monotonic across reloads. */
export async function seedClock(): Promise<void> {
  clock.receive(readLocal())
  const raw = await runtime().db.get<number>(META_STORE, LAST_KEY)
  if (typeof raw === "number" && Number.isFinite(raw)) clock.receive(raw)
}

export async function persistClock(): Promise<void> {
  writeLocal(clock.last)
  try {
    await runtime().db.set(META_STORE, LAST_KEY, clock.last)
  } catch {
    // Storage unavailable; the next seed re-derives from remote timestamps.
  }
}

/** Timestamp for a local mutation; the high-water mark is durable before it returns. */
export function stamp(): number {
  const ts = clock.now()
  void persistClock()
  return ts
}
