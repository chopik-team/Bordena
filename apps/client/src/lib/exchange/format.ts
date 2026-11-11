import { t } from "@bordena/i18n"
import { z } from "zod"
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate"
import {
  AttachmentSchema,
  CardSchema,
  ColumnSchema,
  DashboardSchema,
  HistoryEntrySchema,
  SidebarLayoutSchema,
  EntityIdSchema,
  CalendarStateSchema,
} from "@bordena/contract"
import { generateKeyBetween } from "fractional-indexing"
import { MAX_FILE_BYTES } from "../adapters/local-files"
import {
  validateLayout,
  validateGoal,
  validateLinks,
  validateFieldValues,
  validateCalendarLinks,
} from "@bordena/core"
import { PreferencesSchema } from "../preferences"
export const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
export const MAX_JSON_BYTES = 16 * 1024 * 1024
export const MAX_ENTITIES = 50000
const id = EntityIdSchema
const rank = z
  .string()
  .max(256)
  .refine((value) => {
    try {
      if (!/^[A-Za-z][0-9A-Za-z]*$/.test(value)) return false
      generateKeyBetween(value, null)
      return true
    } catch {
      return false
    }
  })
const text = z.string().max(4096)
const time = z.number().finite().nonnegative()
const extensions = z.record(z.string().max(128), z.json()).optional()
const attachment = AttachmentSchema.extend({
  id,
  name: text,
  mime: z.string().max(256),
  size: z.number().int().min(0).max(MAX_FILE_BYTES),
})
const card = CardSchema.extend({
  id,
  columnId: id,
  position: rank,
  title: text,
  body: z.string().max(2 * 1024 * 1024),
  updatedAt: time,
  deletedAt: time.nullable(),
  priority: z.string().refine((v) => ["", "low", "medium", "high"].includes(v)),
  tags: z.array(z.string().max(256)).max(1000),
  users: z.array(id).max(1000),
  attachments: z.array(attachment).max(1000),
})
const column = ColumnSchema.extend({
  id,
  dashboardId: id,
  title: text,
  position: rank,
  updatedAt: time,
  deletedAt: time.nullable(),
})
const dashboard = DashboardSchema.extend({
  id,
  title: text,
  position: rank,
  updatedAt: time,
  deletedAt: time.nullable(),
})
export const DocumentSchema = z
  .object({
    format: z.literal("bordena"),
    schemaVersion: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    exportedAt: z.iso.datetime(),
    scope: z.enum(["board", "workspace"]),
    boards: z
      .array(
        z
          .object({
            dashboard,
            columns: z.array(column).max(MAX_ENTITIES),
            cards: z.array(card).max(MAX_ENTITIES),
            extensions,
          })
          .strict()
      )
      .max(1000),
    attachmentsManifest: z
      .array(
        z
          .object({
            cardId: id,
            key: attachment.shape.key,
            path: z.string().max(300),
            size: z.number().int().min(0).max(MAX_FILE_BYTES),
            sha256: z.string().regex(/^[0-9a-f]{64}$/),
          })
          .strict()
      )
      .max(MAX_ENTITIES),
    organization: z
      .object({
        workspaces: z
          .array(
            z
              .object({ id, title: text, archived: z.boolean().optional() })
              .strict()
          )
          .min(1)
          .max(1000),
      })
      .strict()
      .optional(),
    preferences: PreferencesSchema.optional(),
    workspace: z
      .object({
        sidebar: SidebarLayoutSchema.optional(),
        history: z.array(HistoryEntrySchema).max(MAX_ENTITIES),
      })
      .strict()
      .optional(),
    extensions,
    calendar: CalendarStateSchema.optional(),
  })
  .strict()
export type BordenaDocument = z.infer<typeof DocumentSchema>
export const documentJsonSchema = () =>
  z.toJSONSchema(DocumentSchema, { target: "draft-2020-12", io: "input" })
export interface ImportPayload {
  document: BordenaDocument
  files: Map<string, Blob>
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer
  )
  return Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, "0")
  ).join("")
}
export function validateDocument(input: unknown): BordenaDocument {
  const parsed = DocumentSchema.safeParse(input)
  if (!parsed.success)
    throw new Error(
      t(
        "Неверный формат Bordena JSON v1/v2/v3/v4/v5/v6 или превышены ограничения полей"
      )
    )
  const doc = parsed.data
  if (doc.calendar && doc.schemaVersion < 6)
    throw new Error("Calendar data requires Bordena JSON v6")
  if (doc.calendar)
    validateCalendarLinks(doc.calendar, {
      dashboards: doc.boards.map((b) => b.dashboard),
      columns: doc.boards.flatMap((b) => b.columns),
      cards: doc.boards.flatMap((b) => b.cards),
      sidebar: doc.workspace?.sidebar,
    })
  for (const board of doc.boards) {
    validateGoal(board.dashboard)
    for (const card of board.cards) {
      if (
        new Set(card.automationRules?.map((r) => r.id)).size !==
        (card.automationRules?.length ?? 0)
      )
        throw new Error("Duplicate automation rule ID")
      if (
        new Set(card.automationState?.map((s) => s.ruleId)).size !==
          (card.automationState?.length ?? 0) ||
        card.automationState?.some(
          (s) =>
            s.cardId !== card.id ||
            !card.automationRules?.some((r) => r.id === s.ruleId)
        )
      )
        throw new Error("Invalid automation execution owner")
    }
  }
  const spaces =
    doc.organization?.workspaces ?? doc.workspace?.sidebar?.workspaces
  if (
    !spaces &&
    doc.boards.some(
      (board) =>
        board.dashboard.workspaceId && board.dashboard.workspaceId !== "default"
    )
  )
    throw new Error(t("Рабочее пространство доски отсутствует"))
  if (spaces) {
    const ids = new Set(spaces.map((space) => space.id))
    if (ids.size !== spaces.length)
      throw new Error(t("Повтор рабочего пространства"))
    for (const board of doc.boards)
      if (!ids.has(board.dashboard.workspaceId ?? "default"))
        throw new Error(t("Рабочее пространство доски отсутствует"))
    for (const item of doc.workspace?.sidebar?.items ?? [])
      if (item.type === "folder" && !ids.has(item.workspaceId ?? "default"))
        throw new Error(t("Рабочее пространство проекта отсутствует"))
  }
  const seen = new Set<string>()
  const cards = new Map<string, z.infer<typeof card>>()
  const add = (value: string) => {
    if (seen.has(value))
      throw new Error(t("Повторяющийся идентификатор в файле"))
    seen.add(value)
    if (seen.size > MAX_ENTITIES) throw new Error(t("Превышено число объектов"))
  }
  for (const entity of [
    ...(doc.calendar?.calendars ?? []),
    ...(doc.calendar?.events ?? []),
    ...(doc.calendar?.profiles ?? []),
  ])
    add(entity.id)
  for (const board of doc.boards) {
    add(board.dashboard.id)
    const layout = board.dashboard.layout
    if (layout) validateLayout(layout)
    const cols = new Set<string>()
    for (const col of board.columns) {
      add(col.id)
      cols.add(col.id)
      if (col.dashboardId !== board.dashboard.id)
        throw new Error(t("Нарушена связь колонки с доской"))
    }
    for (const item of board.cards) {
      add(item.id)
      cards.set(item.id, item)
      if (!cols.has(item.columnId))
        throw new Error(t("Нарушена связь карточки с колонкой"))
      if (
        layout &&
        ((item.stageId && !layout.stages.some((s) => s.id === item.stageId)) ||
          (item.stateId && !layout.states.some((s) => s.id === item.stateId)))
      )
        throw new Error(t("Неверный этап или состояние карточки"))
      const attachmentIds = new Set(item.attachments.map((a) => a.id))
      if (attachmentIds.size !== item.attachments.length)
        throw new Error(t("Повтор вложения"))
      validateFieldValues(item, board.dashboard.fieldDefinitions ?? [])
    }
    const fields = board.dashboard.fieldDefinitions ?? []
    if (new Set(fields.map((f) => f.id)).size !== fields.length)
      throw new Error("Duplicate custom field ID")
    for (const mirror of board.dashboard.mirrors ?? []) {
      add(mirror.id)
      if (!cols.has(mirror.columnId))
        throw new Error("Mirror section is unavailable")
      rank.parse(mirror.position)
      if (
        layout &&
        ((mirror.stageId &&
          !layout.stages.some((s) => s.id === mirror.stageId)) ||
          (mirror.stateId &&
            !layout.states.some((s) => s.id === mirror.stateId)))
      )
        throw new Error("Mirror axes are unavailable")
    }
  }
  validateLinks({
    dashboards: doc.boards.map((b) => b.dashboard),
    columns: doc.boards.flatMap((b) => b.columns),
    cards: doc.boards.flatMap((b) => b.cards),
  })
  const paths = new Set<string>()
  for (const item of doc.attachmentsManifest) {
    // Paths are generated, never joined to an arbitrary user-controlled root.
    const expected = `attachments/${item.cardId}/${item.key.slice(4)}`
    if (item.path !== expected || paths.has(item.path))
      throw new Error(t("Небезопасный или повторный путь вложения"))
    paths.add(item.path)
    const found = cards
      .get(item.cardId)
      ?.attachments.filter((a) => a.key === item.key)
    if (found?.length !== 1 || found[0].size !== item.size)
      throw new Error(t("Manifest не соответствует карточке"))
  }
  const count = [...cards.values()].reduce(
    (n, c) => n + c.attachments.length,
    0
  )
  if (count !== paths.size) throw new Error(t("Manifest вложений неполон"))
  if (doc.scope === "board" && (doc.boards.length !== 1 || doc.workspace))
    throw new Error(t("Неверная область экспорта"))
  const boardIds = new Set(doc.boards.map((b) => b.dashboard.id))
  const sidebarIds = new Set<string>()
  for (const item of doc.workspace?.sidebar?.items ?? []) {
    if (item.type === "folder") add(item.id)
    for (const boardId of item.type === "board" ? [item.id] : item.boardIds) {
      if (!boardIds.has(boardId) || sidebarIds.has(boardId))
        throw new Error(t("Неверное дерево досок"))
      sidebarIds.add(boardId)
      if (
        item.type === "folder" &&
        (item.workspaceId ?? "default") !==
          (doc.boards.find((board) => board.dashboard.id === boardId)?.dashboard
            .workspaceId ?? "default")
      )
        throw new Error(t("Неверное дерево досок"))
    }
  }
  const historyIds = new Set<string>()
  for (const item of doc.workspace?.history ?? []) {
    if (
      (!boardIds.has(item.boardId) &&
        !(item.boardId === "calendar" && doc.calendar)) ||
      historyIds.has(item.id)
    )
      throw new Error(t("Неверная история досок"))
    historyIds.add(item.id)
  }
  return doc
}
export function encodeJson(document: BordenaDocument): Uint8Array {
  const doc = validateDocument(document)
  const json = strToU8(JSON.stringify(doc, null, 2))
  if (json.length > MAX_JSON_BYTES) throw new Error(t("JSON превышает 16 МиБ"))
  return json
}
export async function encodeArchive(
  payload: ImportPayload
): Promise<Uint8Array> {
  const doc = validateDocument(payload.document)
  const json = encodeJson(doc)
  const files: Record<string, Uint8Array> = {
    "bordena.json": json,
    "bordena.sha256": strToU8(await sha256(json)),
  }
  let size = json.length
  for (const item of doc.attachmentsManifest) {
    const blob = payload.files.get(item.path)
    if (!blob || blob.size !== item.size)
      throw new Error(t("Вложение отсутствует"))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if ((await sha256(bytes)) !== item.sha256)
      throw new Error(t("Контрольная сумма вложения не совпадает"))
    size += bytes.length
    if (size > MAX_ARCHIVE_BYTES)
      throw new Error(t("Резервная копия превышает 128 МиБ"))
    files[item.path] = bytes
  }
  const zip = zipSync(files, { level: 0 }) // predictable memory; no base64
  if (zip.length > MAX_ARCHIVE_BYTES)
    throw new Error(t("Архив превышает 128 МиБ"))
  return zip
}
export async function decodeImport(bytes: Uint8Array): Promise<ImportPayload> {
  if (bytes.length > MAX_ARCHIVE_BYTES)
    throw new Error(t("Файл превышает 128 МиБ"))
  let entries: Record<string, Uint8Array> | null = null
  let json: Uint8Array = bytes
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let total = 0,
      count = 0
    try {
      entries = unzipSync(bytes, {
        filter: (file) => {
          total += file.originalSize
          count++
          if (
            total > MAX_ARCHIVE_BYTES ||
            count > MAX_ENTITIES + 2 ||
            file.originalSize >
              (file.name === "bordena.json"
                ? MAX_JSON_BYTES
                : MAX_FILE_BYTES) ||
            !/^(bordena\.(json|sha256)|attachments\/[a-zA-Z0-9_-]{1,128}\/[0-9a-f-]+(?:\.[a-z0-9]+)?)$/.test(
              file.name
            )
          )
            throw new Error(t("Недопустимое содержимое архива"))
          return true
        },
      })
      if (Object.keys(entries).length !== count)
        throw new Error(t("Повторный путь в архиве"))
    } catch {
      throw new Error(
        t("Архив повреждён, небезопасен или превышает ограничения")
      )
    }
    json = entries["bordena.json"]
    if (
      !json ||
      strFromU8(entries["bordena.sha256"] ?? new Uint8Array()) !==
        (await sha256(json))
    )
      throw new Error(t("Нарушена целостность JSON в архиве"))
  }
  if (json.length > MAX_JSON_BYTES) throw new Error(t("JSON превышает 16 МиБ"))
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json))
  } catch {
    throw new Error(t("Файл не является корректным UTF-8 JSON"))
  }
  const document = validateDocument(input)
  const files = new Map<string, Blob>()
  for (const item of document.attachmentsManifest) {
    const data = entries?.[item.path]
    if (
      !data ||
      data.length !== item.size ||
      (await sha256(data)) !== item.sha256
    )
      throw new Error(
        t("Вложение отсутствует или повреждено; импортируйте полный ZIP")
      )
    const mime = document.boards
      .flatMap((b) => b.cards)
      .find((c) => c.id === item.cardId)!
      .attachments.find((a) => a.key === item.key)!.mime
    files.set(
      item.path,
      new Blob([new Uint8Array(data).buffer], { type: mime })
    )
  }
  if (entries && Object.keys(entries).length !== files.size + 2)
    throw new Error(t("В архиве есть незаявленные файлы"))
  return { document, files }
}
