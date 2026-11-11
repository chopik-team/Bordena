import {
  CalendarStateSchema,
  emptyCalendarState,
  type CalendarState,
} from "@bordena/contract"
import { CALENDAR_KEY, queryClient, stamp } from "@bordena/core"
import { webDb, notifyDataWrite } from "./adapters/web-db"
import { recordCommand } from "./structural-history"
import { requestLinkedSync } from "./linked-sync"

/** Calendar-only undo never replaces boards/blobs or invalidates other windows' profile epoch. */
export function recordCalendarCommand(
  before: CalendarState | undefined,
  after: CalendarState,
  label?: string
): void {
  let expected = structuredClone(after)
  const restore = async (target: CalendarState) => {
    await webDb.writeLocked(async () => {
      const current = CalendarStateSchema.parse(
        (await webDb.get("meta", CALENDAR_KEY)) ?? emptyCalendarState()
      )
      if (JSON.stringify(current) !== JSON.stringify(expected))
        throw new Error("Calendar changed after this action")
      const next = structuredClone(target),
        now = stamp()
      for (const event of next.events) {
        const latest = current.events.find((e) => e.id === event.id)
        if (latest?.execution)
          event.execution = {
            ...latest.execution,
            key: `${event.start}/${event.end}`,
          }
      }
      for (const field of ["calendars", "events", "profiles"] as const)
        for (const entity of next[field]) {
          const latest = current[field].find((e) => e.id === entity.id)
          if (
            !latest ||
            JSON.stringify({ ...latest, updatedAt: 0 }) !==
              JSON.stringify({ ...entity, updatedAt: 0 })
          )
            entity.updatedAt = now
          else entity.updatedAt = latest.updatedAt
        }
      next.updatedAt = now
      CalendarStateSchema.parse(next)
      await webDb.run("meta", "readwrite", (s) => s.put(next, CALENDAR_KEY))
      notifyDataWrite({
        store: "meta",
        key: CALENDAR_KEY,
        before: current,
        after: next,
        source: "command",
      })
      expected = next
    })
    const channel = new BroadcastChannel("bordena-linked-progress-v1")
    channel.postMessage("workspace")
    channel.close()
    requestLinkedSync()
    await queryClient.invalidateQueries({ queryKey: ["calendar"] })
  }
  recordCommand({
    label,
    undo: () => restore(before ?? emptyCalendarState()),
    redo: () => restore(after),
  })
}
