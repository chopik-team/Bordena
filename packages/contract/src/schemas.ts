import {
  GoalPathSchema,
  AutomationRuleSchema,
  AutomationExecutionSchema,
} from "./planning-schemas"
import { BoardLayoutSchema } from "./layout-schemas"
export { BoardLayoutSchema } from "./layout-schemas"
import { z } from "zod"
import {
  BoardLinkSchema,
  FieldDefinitionSchema,
  MirrorSchema,
  ExternalFileSchema,
  BoardTemplateSchema,
  DeadlineSchema,
} from "./automation-schemas"

/**
 * Entity schemas shared by client and server
 *
 *  - `updatedAt`: client clock (ms). The last-writer-wins tiebreaker. On cards
 *    and columns it equals the newest of `stamps`.
 *  - `deletedAt`: tombstone. `null` while live; set to a timestamp on delete so
 *    the deletion propagates to other clients instead of vanishing silently.
 */

/**
 * Field groups: the unit of last-writer-wins on cards and columns.
 * `updatedAt` equals `max(stamps)`; a group with no stamp reads as `updatedAt`.
 * A tie on a group keeps what is stored.
 */
export const CARD_GROUPS = [
  "title",
  "body",
  "place",
  "deadline",
  "priority",
  "color",
  "tags",
  "users",
  "attachments",
  "deleted",
  "conflict",
  "axes",
  "progress",
  "links",
  "fields",
  "automation",
] as const

export const COLUMN_GROUPS = [
  "title",
  "position",
  "collapsed",
  "color",
  "done",
  "deleted",
] as const

export type CardGroup = (typeof CARD_GROUPS)[number]
export type ColumnGroup = (typeof COLUMN_GROUPS)[number]

/**
 * A file attached to a card.
 *
 *  - `name`: editable display label, shown on the tile. Independent of storage.
 *  - `key`: opaque, backend-specific handle (an S3 object key, or a filename in
 *    the card's on-disk sidecar). Rewritten when files migrate between backends.
 */

const ATTACHMENT_KEY =
  /^att\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(\.[a-z0-9]+)?$/

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string().regex(ATTACHMENT_KEY),
  mime: z.string(),
  size: z.number(),
  pinned: z.boolean().optional(),
  group: z.string().max(256).optional(),
})

export const CardSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  position: z.string(),
  columnId: z.string(),
  /**
   * Human-readable per-board card number, shown as the card's id. Allocated
   * server-side from a per-board counter on the card's first sync, so it's
   * `null` until then.
   */
  number: z.number().nullable().default(null),
  /** Optional deadline as an ISO date string (`YYYY-MM-DD`); `null` when unset. */
  deadline: DeadlineSchema.nullable().default(null),
  /** Importance: `high` / `medium` / `low`, empty for none. See `PRIORITIES`. */
  priority: z.string().default(""),
  color: z.string().max(32).optional(),
  /** `#tags`*/
  tags: z.array(z.string()).default([]),
  /** User ids tagged on the card. */
  users: z.array(z.string()).default([]),
  /** Attached files; travels with the card's last-writer-wins record. */
  attachments: z.array(AttachmentSchema).default([]),
  stageId: z.string().max(128).optional(),
  stateId: z.string().max(128).optional(),
  progress: z.number().finite().min(0).max(100).nullable().optional(),
  boardLink: BoardLinkSchema.nullable().optional(),
  /** Optional custom calendar. Every card also belongs to the general view. */
  calendarId: z.string().min(1).max(128).nullable().optional(),
  linkedProgress: z
    .object({
      value: z.number().min(0).max(100).nullable(),
      reason: z.enum(["available", "missing", "empty", "unset"]),
      moveKey: z.string().max(1024).optional(),
    })
    .strict()
    .optional(),
  fieldValues: z
    .record(
      z.string().max(128),
      z.union([
        z.string().max(4096),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ])
    )
    .optional(),
  externalFiles: z.array(ExternalFileSchema).max(1000).optional(),
  archived: z.boolean().optional(),
  automationRules: z.array(AutomationRuleSchema).max(100).optional(),
  automationState: z.array(AutomationExecutionSchema).max(100).optional(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  stamps: z.partialRecord(z.enum(CARD_GROUPS), z.number()).default({}),
  /** The body that lost a 3-way merge; `null` while nothing is pending. */
  bodyConflict: z
    .object({ body: z.string(), at: z.number() })
    .nullable()
    .default(null),
})

/** Exhaustive on purpose: a field without a group is a type error. */
export const CARD_FIELD_GROUP: Record<
  Exclude<
    keyof z.infer<typeof CardSchema>,
    "id" | "number" | "updatedAt" | "stamps"
  >,
  CardGroup
> = {
  title: "title",
  body: "body",
  columnId: "place",
  position: "place",
  deadline: "deadline",
  priority: "priority",
  color: "color",
  tags: "tags",
  users: "users",
  attachments: "attachments",
  deletedAt: "deleted",
  bodyConflict: "conflict",
  stageId: "axes",
  stateId: "axes",
  progress: "progress",
  boardLink: "links",
  calendarId: "links",
  linkedProgress: "links",
  fieldValues: "fields",
  externalFiles: "attachments",
  archived: "automation",
  automationRules: "automation",
  automationState: "automation",
}

export const ColumnSchema = z.object({
  id: z.string(),
  title: z.string(),
  position: z.string(),
  dashboardId: z.string(),
  /** When true the column's card bodies are collapsed down to their titles. */
  collapsed: z.boolean().default(false),
  /**
   * Palette id tinting the column and any `[[card]]` reference to a card in
   * it. Empty for no color; see `COLUMN_COLORS` in the ui-kit.
   */
  color: z.string().default(""),
  /** Cards in this column are finished. At most one column per board has it. */
  done: z.boolean().default(false),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  stamps: z.partialRecord(z.enum(COLUMN_GROUPS), z.number()).default({}),
})

export const COLUMN_FIELD_GROUP: Record<
  Exclude<
    keyof z.infer<typeof ColumnSchema>,
    "id" | "dashboardId" | "updatedAt" | "stamps"
  >,
  ColumnGroup
> = {
  title: "title",
  position: "position",
  collapsed: "collapsed",
  color: "color",
  done: "done",
  deletedAt: "deleted",
}

export const DashboardSchema = z.object({
  id: z.string(),
  title: z.string(),
  position: z.string(),
  sort: z.array(z.string()).default([]),
  layout: BoardLayoutSchema.optional(),
  goalPath: GoalPathSchema.optional(),
  progress: z.number().finite().min(0).max(100).nullable().optional(),
  workspaceId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,128}$/)
    .optional(),
  archived: z.boolean().optional(),
  color: z.string().max(32).optional(),
  priority: z.enum(["", "low", "medium", "high"]).optional(),
  deadline: DeadlineSchema.nullable().optional(),
  fieldDefinitions: z.array(FieldDefinitionSchema).max(100).optional(),
  mirrors: z.array(MirrorSchema).max(50000).optional(),
  tableFields: z.array(z.string().max(128)).max(100).optional(),
  defaultCalendarId: z.string().min(1).max(128).nullable().optional(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
})

/**
 * One entry of the sidebar tree
 */
export const SidebarItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("board"), id: z.string() }),
  z.object({
    type: z.literal("folder"),
    id: z.string(),
    title: z.string(),
    boardIds: z.array(z.string()).default([]),
    workspaceId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/)
      .optional(),
    archived: z.boolean().optional(),
    deadline: DeadlineSchema.nullable().optional(),
    priority: z.enum(["", "low", "medium", "high"]).optional(),
    color: z.string().max(32).optional(),
  }),
])

/**
 * How one account lays out its sidebar. A single record per user.
 */
export const SidebarLayoutSchema = z.object({
  id: z.literal("layout"),
  templates: z.array(BoardTemplateSchema).max(1000).optional(),
  items: z.array(SidebarItemSchema).default([]),
  workspaces: z
    .array(
      z.object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
        title: z.string().min(1).max(4096),
        archived: z.boolean().optional(),
      })
    )
    .max(1000)
    .optional(),
  updatedAt: z.number(),
  deletedAt: z.null(),
})

/**
 * The whole of a published board, as `GET /api/public/b/:token` returns it.
 *
 * Built out of the record schemas above on purpose: everything the sync tables
 * carry beyond them — `seq`, `owner_id`, the share token itself — is internal,
 * and reusing the wire shapes is what keeps it out. Tombstones are excluded by
 * the query, so every record here is live.
 */
export const PublicBoardSchema = z.object({
  dashboard: DashboardSchema,
  columns: z.array(ColumnSchema),
  cards: z.array(CardSchema),
})

/** Ship editors only; `'owner'` exists so widening roles needs no migration. */
export const MemberRoleSchema = z.enum(["owner", "editor"])

/** Someone with access to a board, as the share dialog's roster renders them.
 * The owner is in there too, with `role: 'owner'` and no membership row. */
export const MemberSchema = z.object({
  userId: z.string(),
  username: z.string(),
  image: z.string().nullable(),
  role: MemberRoleSchema,
})

/** An account in the server's directory — everything the member picker gets. */
export const DirectoryUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  image: z.string().nullable(),
})

export const HISTORY_ENTITY_TYPES = ["card", "column", "board"] as const
export const HISTORY_ACTIONS = [
  "create",
  "edit",
  "rename",
  "move",
  "delete",
  "restore",
] as const

export const HistoryEntrySchema = z.object({
  id: z.string(),
  boardId: z.string(),
  entityId: z.string(),
  entityType: z.enum(HISTORY_ENTITY_TYPES),
  userId: z.string().nullable(),
  action: z.enum(HISTORY_ACTIONS),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
  updatedAt: z.number(),
  // Never tombstoned, only purged by age. Here so generic sync helpers accept the row.
  deletedAt: z.null(),
})

const DashboardRecordChangeSchema = z.object({
  store: z.literal("dashboards"),
  record: DashboardSchema,
})

const SidebarChangeSchema = z.object({
  store: z.literal("sidebar"),
  record: SidebarLayoutSchema,
})

/** A change on the account-level channel (see `dashboards.sync`): a dashboard
 * or the caller's sidebar layout. */
export const DashboardChangeSchema = z.discriminatedUnion("store", [
  DashboardRecordChangeSchema,
  SidebarChangeSchema,
])

/** One board-channel record change, tagged by the store it belongs to. */
export const ChangeSchema = z.discriminatedUnion("store", [
  z.object({
    store: z.literal("cards"),
    record: CardSchema,
    /** The synced body the local edit started from; the server merges against it. */
    baseBody: z.string().optional(),
  }),
  z.object({ store: z.literal("columns"), record: ColumnSchema }),
  DashboardRecordChangeSchema,
])
