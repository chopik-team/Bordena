import { CARD_FIELD_GROUP, CardSchema } from "@bordena/contract"
import type { Card } from "../../types"
import { db } from "../db/db"
import { recordEdit } from "../history/record-edit"
import { sync } from "../sync"
import { touchCard } from "../sync/touch"
import { t } from "@bordena/i18n"

/** Updates a card's own fields, preserving column and position. */
export async function updateCard(
  id: string,
  patch: Partial<
    Pick<
      Card,
      | "title"
      | "body"
      | "deadline"
      | "priority"
      | "color"
      | "tags"
      | "users"
      | "attachments"
      | "bodyConflict"
      | "stageId"
      | "stateId"
      | "progress"
      | "boardLink"
      | "calendarId"
      | "fieldValues"
      | "externalFiles"
    >
  >,
  expected?: { body: string }
): Promise<void> {
  CardSchema.pick({
    color: true,
    progress: true,
    stageId: true,
    stateId: true,
    boardLink: true,
    calendarId: true,
    fieldValues: true,
    externalFiles: true,
    deadline: true,
  }).parse(patch)
  const fields = Object.keys(patch) as (keyof typeof patch)[]
  const groups = fields.map((field) => CARD_FIELD_GROUP[field])
  let existing: Card | undefined
  const card = await db.editCard(id, (current) => {
    if (expected && current.body !== expected.body)
      throw new Error(t("Текст изменился. Откройте календарь заново."))
    existing = current
    return touchCard({ ...current, ...patch, id }, groups)
  })
  if (!card || !existing) return
  sync.markDirty("cards", id)
  await recordEdit(card, patch, existing)
}
