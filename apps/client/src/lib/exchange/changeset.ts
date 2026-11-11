import { z } from "zod"
import {
  CardSchema,
  ColumnSchema,
  DashboardSchema,
  EntityIdSchema,
  CARD_GROUPS,
  CARD_FIELD_GROUP,
  COLUMN_GROUPS,
  COLUMN_FIELD_GROUP,
  type Card,
  emptyCalendarState,
  generalCalendar,
  GENERAL_CALENDAR_ID,
} from "@bordena/contract"
import {
  initialLayout,
  reconcileAutomation,
  archivedAutomationBoards,
  rebaseAutomationAfterUndo,
  recordGoalMeasurement,
  validateRuleTarget,
  queryClient,
  stamp,
  flushCardEdits,
  validateLayout,
  validateCalendarLinks,
  calendarOccurrences,
  zonedInstant,
  calendarDayShift,
} from "@bordena/core"
import { generateKeyBetween } from "fractional-indexing"
import {
  validateDocument,
  sha256,
  MAX_JSON_BYTES,
  type BordenaDocument,
} from "./format"
import {
  exportWorkspaceWithPreview,
  applyImport,
  readBackup,
  pruneAutomaticBackups,
  type BackupRecord,
  applyPlannedDocument,
} from "./workspace"
import { webDb } from "../adapters/web-db"
import { requestLinkedSync } from "../linked-sync"
import {
  recordCommand,
  resetStructuralHistory,
  recordStructuralBatch,
} from "../structural-history"
import { t } from "@bordena/i18n"
import { recordCalendarCommand } from "../calendar-history"

import {
  ChangesetSchema,
  builtinTemplates,
  type Operation,
} from "./changeset-schema"
export {
  ChangesetSchema,
  builtinTemplates,
  type Changeset,
  type Operation,
  type Template,
} from "./changeset-schema"

type Ledger = { id: string; sha256: string }
function ledger(document: BordenaDocument): Ledger[] {
  const data = document.extensions?.appliedChangesets
  return z
    .array(
      z
        .object({
          id: EntityIdSchema,
          sha256: z.string().regex(/^[0-9a-f]{64}$/),
        })
        .strict()
    )
    .max(10000)
    .parse(data ?? [])
}
const appendRank = (items: { position: string }[]) =>
  generateKeyBetween(
    items
      .map((x) => x.position)
      .sort()
      .at(-1) ?? null,
    null
  )
function requireRevision<T extends { updatedAt: number }>(
  entity: T | undefined,
  expected: number
): T {
  if (!entity) throw new Error("Target object is unavailable")
  if (entity.updatedAt !== expected)
    throw new Error(
      "Stale revision: export the latest data before applying changes"
    )
  return entity
}
/** Pure validation/planning. No files, shell, dynamic code, or writes are reachable here. */
export function planChangeset(
  document: BordenaDocument,
  input: unknown,
  now = Date.now(),
  freshId: () => string = () => crypto.randomUUID()
): BordenaDocument {
  const changeset = ChangesetSchema.parse(input),
    next = structuredClone(document)
  next.schemaVersion = next.calendar ? 6 : 5
  const known = new Set(
    next.boards.flatMap((b) => [
      b.dashboard.id,
      ...b.columns.map((c) => c.id),
      ...b.cards.map((c) => c.id),
      ...(b.dashboard.mirrors ?? []).map((m) => m.id),
    ])
  )
  for (const entity of [
    ...(next.calendar?.calendars ?? []),
    ...(next.calendar?.events ?? []),
    ...(next.calendar?.profiles ?? []),
  ])
    known.add(entity.id)
  const spaces = next.organization?.workspaces ?? [
    { id: "default", title: "Личное пространство" },
  ]
  next.organization = { workspaces: spaces }
  next.workspace ??= { history: [] }
  next.workspace.sidebar ??= {
    id: "layout",
    items: [],
    updatedAt: now,
    deletedAt: null,
  }
  const sidebar = next.workspace.sidebar
  const sidebarRevision = document.workspace?.sidebar?.updatedAt ?? 0
  const checkSidebarRevision = (expected: number) =>
    requireRevision({ updatedAt: sidebarRevision }, expected)
  next.workspace.history.forEach((entry) => known.add(entry.id))
  const baseRevisions = new Map(
    next.boards
      .flatMap((b) => [b.dashboard, ...b.columns, ...b.cards])
      .map((x) => [x.id, x.updatedAt])
  )
  const checkRevision = <T extends { id: string; updatedAt: number }>(
    entity: T | undefined,
    expected: number
  ): T => {
    if (!entity) throw new Error("Target object is unavailable")
    requireRevision({ updatedAt: baseRevisions.get(entity.id) ?? 0 }, expected)
    return entity
  }
  spaces.forEach((s) => known.add(s.id))
  sidebar.items.forEach((i) => {
    if (i.type === "folder") known.add(i.id)
  })
  const newId = (value: string) => {
    if (known.has(value)) throw new Error("ID conflict: " + value)
    known.add(value)
    return value
  }
  const boardById = (value: string) => {
    const b = next.boards.find(
      (b) => b.dashboard.id === value && !b.dashboard.deletedAt
    )
    if (!b) throw new Error("Board is unavailable")
    return b
  }
  const cardById = (value: string) => {
    for (const b of next.boards) {
      const card = b.cards.find((c) => c.id === value && !c.deletedAt)
      if (card) return { board: b, card }
    }
    throw new Error("Card is unavailable")
  }
  for (const op of changeset.operations) {
    if (
      [
        "create-calendar",
        "update-calendar",
        "create-calendar-event",
        "update-calendar-event",
        "cancel-calendar-event",
        "update-calendar-instance",
        "upsert-availability",
      ].includes(op.op)
    ) {
      const state = (next.calendar ??= emptyCalendarState())
      const check = <T extends { id: string; updatedAt: number }>(
        items: T[],
        id: string,
        expected: number
      ) =>
        requireRevision(
          items.find((item) => item.id === id),
          expected
        )
      if (op.op === "create-calendar") {
        newId(op.calendar.id)
        state.calendars.push({ ...op.calendar, updatedAt: now })
      } else if (op.op === "update-calendar") {
        if (
          op.id === GENERAL_CALENDAR_ID &&
          (op.calendar.deletedAt ||
            !op.calendar.visible ||
            !op.calendar.showDeadlines ||
            op.calendar.workspaceId ||
            op.calendar.sourceBoardIds.length)
        )
          throw new Error("The general calendar always includes all tasks")
        check(document.calendar?.calendars ?? [], op.id, op.expectedUpdatedAt)
        if (op.id !== op.calendar.id) throw new Error("ID mismatch")
        state.calendars = state.calendars.map((c) =>
          c.id === op.id ? { ...op.calendar, updatedAt: now } : c
        )
        const previous = document.calendar!.calendars.find(
          (c) => c.id === op.id
        )!
        if (
          previous.profileId !== op.calendar.profileId ||
          previous.reschedule !== op.calendar.reschedule ||
          previous.horizon !== op.calendar.horizon
        )
          state.events = state.events.map((e) =>
            e.calendarId === op.id && e.execution?.result === "needs-planning"
              ? { ...e, execution: undefined }
              : e
          )
      } else if (op.op === "create-calendar-event") {
        if (
          op.event.calendarId === GENERAL_CALENDAR_ID &&
          !state.calendars.some((c) => c.id === GENERAL_CALENDAR_ID)
        ) {
          newId(GENERAL_CALENDAR_ID)
          state.calendars.push({ ...generalCalendar(), updatedAt: now })
        }
        newId(op.event.id)
        state.events.push({ ...op.event, updatedAt: now })
      } else if (op.op === "update-calendar-event") {
        check(document.calendar?.events ?? [], op.id, op.expectedUpdatedAt)
        if (op.id !== op.event.id) throw new Error("ID mismatch")
        state.events = state.events.map((e) =>
          e.id === op.id ? { ...op.event, updatedAt: now } : e
        )
      } else if (
        op.op === "cancel-calendar-event" ||
        op.op === "update-calendar-instance"
      ) {
        check(document.calendar?.events ?? [], op.id, op.expectedUpdatedAt)
        const event = state.events.find((e) => e.id === op.id)!
        const instanceDay =
          op.op === "update-calendar-instance" ? op.day : op.instance
        if (instanceDay) {
          const start = zonedInstant(instanceDay + "T00:00", event.timeZone)!,
            end = zonedInstant(
              calendarDayShift(instanceDay, 1) + "T00:00",
              event.timeZone
            )!
          if (
            !event.recurrence ||
            !calendarOccurrences(
              { ...event, exceptions: undefined },
              start,
              end
            ).some((o) => o.day === instanceDay)
          )
            throw new Error("Recurrence instance is unavailable")
        }
        if (op.op === "cancel-calendar-event") {
          if (op.instance)
            event.exceptions = { ...event.exceptions, [op.instance]: null }
          else event.status = "cancelled"
        } else event.exceptions = { ...event.exceptions, [op.day]: op.patch }
        event.updatedAt = now
      } else if (op.op === "upsert-availability") {
        if (op.expectedUpdatedAt)
          check(
            document.calendar?.profiles ?? [],
            op.profile.id,
            op.expectedUpdatedAt
          )
        else newId(op.profile.id)
        state.profiles = [
          ...state.profiles.filter((p) => p.id !== op.profile.id),
          { ...op.profile, updatedAt: now },
        ]
        const affected = new Set(
          state.calendars
            .filter((c) => c.profileId === op.profile.id)
            .map((c) => c.id)
        )
        state.events = state.events.map((e) =>
          affected.has(e.calendarId) && e.execution?.result === "needs-planning"
            ? { ...e, execution: undefined }
            : e
        )
      }
      state.updatedAt = now
      next.schemaVersion = 6
      continue
    }
    if (
      [
        "configure-goal-path",
        "reorder-goal-steps",
        "set-goal-metric",
        "record-measurement",
      ].includes(op.op)
    ) {
      if (!("id" in op) || !("expectedUpdatedAt" in op))
        throw new Error("Missing Goal revision")
      const b = boardById(op.id),
        board = checkRevision(b.dashboard, op.expectedUpdatedAt)
      if (op.op === "configure-goal-path") {
        board.layout ??= initialLayout(b.columns, "free")
        for (const stage of op.stages ?? []) {
          const existing = board.layout.stages.find((s) => s.id === stage.id)
          if (existing) existing.title = stage.title
          else board.layout.stages.push({ ...stage })
        }
        board.goalPath = op.goalPath
      } else if (op.op === "reorder-goal-steps") {
        const goal = board.goalPath
        if (
          !goal ||
          op.stepIds.length !== goal.steps.length ||
          new Set(op.stepIds).size !== op.stepIds.length ||
          op.stepIds.some((id) => !goal.steps.some((s) => s.id === id))
        )
          throw new Error("Invalid Goal step ordering")
        goal.steps = op.stepIds.map((id) =>
          goal.steps.find((s) => s.id === id)!
        )
      } else if (op.op === "set-goal-metric") {
        if (!board.goalPath) throw new Error("Goal Path is unavailable")
        const metrics = board.goalPath.metrics
        const index = metrics.findIndex((m) => m.id === op.metric.id)
        if (index < 0) metrics.push(op.metric)
        else metrics[index] = op.metric
      } else if (op.op === "record-measurement") {
        if (!board.goalPath) throw new Error("Goal Path is unavailable")
        board.goalPath = recordGoalMeasurement(
          board.goalPath,
          op.metricId,
          op.measurement,
          op.makeCurrent
        )
      }
      board.updatedAt = now
    } else if (
      [
        "upsert-rule",
        "remove-rule",
        "set-rule-enabled",
        "set-deadline-action",
      ].includes(op.op)
    ) {
      if (!("id" in op) || !("expectedUpdatedAt" in op))
        throw new Error("Missing rule revision")
      const { board, card } = cardById(op.id)
      checkRevision(card, op.expectedUpdatedAt)
      const rules = [...(card.automationRules ?? [])]
      if (op.op === "remove-rule") {
        if (!rules.some((r) => r.id === op.ruleId))
          throw new Error("Rule is unavailable")
        card.automationRules = rules.filter((r) => r.id !== op.ruleId)
        card.automationState = card.automationState?.filter(
          (s) => s.ruleId !== op.ruleId
        )
      } else if (op.op === "set-rule-enabled") {
        const r = rules.find((r) => r.id === op.ruleId)
        if (!r) throw new Error("Rule is unavailable")
        r.enabled = op.enabled
        if (op.paused !== undefined) r.paused = op.paused
        r.revision++
        card.automationRules = rules
      } else if (op.op === "upsert-rule") {
        const old = rules.find((r) => r.id === op.rule.id)
        if (old && op.rule.revision !== old.revision + 1)
          throw new Error("Stale rule revision")
        if (!old && op.rule.revision !== 1)
          throw new Error("New rule revision must be one")
        validateRuleTarget(
          {
            dashboards: [board.dashboard],
            columns: board.columns,
            cards: board.cards,
          },
          board.dashboard,
          op.rule
        )
        card.automationRules = [
          ...rules.filter((r) => r.id !== op.rule.id),
          op.rule,
        ]
      } else if (op.op === "set-deadline-action") {
        const id = "deadline-action",
          old = rules.find((r) => r.id === id)
        card.automationRules = rules.filter((r) => r.id !== id)
        if (op.action) {
          const rule = {
            id,
            title: t("Действие по сроку"),
            revision: (old?.revision ?? 0) + 1,
            enabled: true,
            paused: false,
            includeCompleted: op.includeCompleted,
            includeArchived: op.includeArchived,
            condition: { type: "deadline" as const },
            action: op.action,
          }
          validateRuleTarget(
            {
              dashboards: [board.dashboard],
              columns: board.columns,
              cards: board.cards,
            },
            board.dashboard,
            rule
          )
          card.automationRules.push(rule)
        } else
          card.automationState = card.automationState?.filter(
            (s) => s.ruleId !== id
          )
      }
      card.updatedAt = now
    } else if (op.op === "create-workspace")
      spaces.push({ id: newId(op.id), title: op.title })
    else if (op.op === "create-project") {
      if (!spaces.some((s) => s.id === op.workspaceId))
        throw new Error("Workspace is unavailable")
      sidebar.items.push({
        type: "folder",
        id: newId(op.id),
        title: op.title,
        workspaceId: op.workspaceId,
        boardIds: [],
      })
    } else if (op.op === "update-project") {
      checkSidebarRevision(op.expectedUpdatedAt)
      const project = sidebar.items.find(
        (i) => i.type === "folder" && i.id === op.id
      )
      if (project?.type !== "folder") throw new Error("Project is unavailable")
      if (
        op.patch.workspaceId &&
        !spaces.some((s) => s.id === op.patch.workspaceId)
      )
        throw new Error("Workspace is unavailable")
      Object.assign(project, op.patch)
      if (op.patch.workspaceId)
        for (const board of next.boards)
          if (project.boardIds.includes(board.dashboard.id)) {
            board.dashboard.workspaceId = op.patch.workspaceId
            board.dashboard.updatedAt = now
          }
    } else if (op.op === "update-workspace") {
      checkSidebarRevision(op.expectedUpdatedAt)
      const space = spaces.find((s) => s.id === op.id)
      if (!space) throw new Error("Workspace is unavailable")
      Object.assign(space, op.patch)
    } else if (op.op === "create-board") {
      const workspaceId = op.workspaceId ?? "default"
      if (!spaces.some((s) => s.id === workspaceId))
        throw new Error("Workspace is unavailable")
      const project = sidebar.items.find(
        (i) => i.type === "folder" && i.id === op.projectId
      )
      if (
        op.projectId &&
        (!project ||
          project.type !== "folder" ||
          (project.workspaceId ?? "default") !== workspaceId)
      )
        throw new Error("Project is outside the workspace")
      next.boards.push({
        dashboard: DashboardSchema.parse({
          id: newId(op.id),
          title: op.title,
          position: appendRank(next.boards.map((b) => b.dashboard)),
          workspaceId,
          layout: initialLayout([], op.mode),
          updatedAt: now,
          deletedAt: null,
        }),
        columns: [],
        cards: [],
      })
      if (project?.type === "folder") project.boardIds.push(op.id)
      else sidebar.items.push({ type: "board", id: op.id })
    } else if (op.op === "create-section") {
      const board = boardById(op.boardId),
        column = ColumnSchema.parse({
          id: newId(op.id),
          dashboardId: op.boardId,
          title: op.title,
          color: op.color ?? "",
          done: op.done ?? false,
          position: appendRank(board.columns),
          updatedAt: now,
          deletedAt: null,
        })
      board.columns.push(column)
      const layout =
        board.dashboard.layout ?? initialLayout(board.columns, "free")
      if (!layout.stages.some((s) => s.id === column.id))
        layout.stages.push({
          id: column.id,
          title: column.title,
          color: column.color,
        })
      layout.sections[column.id] = {
        laneId: layout.lanes[0].id,
        stageId: column.id,
        stateId: layout.states[0].id,
        progressMode: "off",
      }
      board.dashboard.layout = layout
      board.dashboard.updatedAt = now
    } else if (op.op === "create-axis") {
      const board = boardById(op.boardId)
      board.dashboard.layout ??= initialLayout(board.columns, "free")
      if (board.dashboard.layout[op.axis].some((axis) => axis.id === op.id))
        throw new Error("ID conflict: " + op.id)
      board.dashboard.layout[op.axis].push({
        id: op.id,
        title: op.title,
        color: op.color,
        ...(op.axis === "states" && op.done !== undefined
          ? { done: op.done }
          : {}),
      })
      board.dashboard.updatedAt = now
    } else if (op.op === "configure-section") {
      const board = boardById(op.boardId)
      checkRevision(board.dashboard, op.expectedUpdatedAt)
      if (
        !board.columns.some((c) => c.id === op.id && !c.deletedAt) ||
        !board.dashboard.layout?.sections[op.id]
      )
        throw new Error("Section is unavailable")
      Object.assign(board.dashboard.layout.sections[op.id], op.patch)
      board.dashboard.updatedAt = now
    } else if (op.op === "create-card") {
      const board = next.boards.find((b) =>
        b.columns.some((c) => c.id === op.columnId && !c.deletedAt)
      )
      if (!board) throw new Error("Section is unavailable")
      board.cards.push(
        CardSchema.parse({
          id: newId(op.id),
          columnId: op.columnId,
          title: op.title,
          body: op.body,
          position: appendRank(
            board.cards.filter((c) => c.columnId === op.columnId)
          ),
          progress: op.progress,
          deadline: op.deadline ?? null,
          updatedAt: now,
          deletedAt: null,
        })
      )
    } else if (
      op.op === "update-card" ||
      op.op === "link-board" ||
      op.op === "move-card"
    ) {
      const { board, card } = cardById(op.id)
      checkRevision(card, op.expectedUpdatedAt)
      if (op.op === "move-card") {
        if (
          op.columnId &&
          !board.columns.some((c) => c.id === op.columnId && !c.deletedAt)
        )
          throw new Error("Move section is outside the board")
        Object.assign(
          card,
          Object.fromEntries(
            Object.entries(op).filter(
              ([key, value]) =>
                ["columnId", "position", "stageId", "stateId"].includes(key) &&
                value !== undefined
            )
          )
        )
        if (op.columnId && !op.position)
          card.position = appendRank(
            board.cards.filter(
              (c) => c.columnId === op.columnId && c.id !== card.id
            )
          )
      } else if (op.op === "update-card") {
        Object.assign(card, op.patch)
        if ("boardLink" in op.patch) delete card.linkedProgress
      } else {
        card.boardLink = op.link
        delete card.linkedProgress
      }
      card.updatedAt = now
    } else if (op.op === "update-board" || op.op === "archive-board") {
      const board = boardById(op.id)
      checkRevision(board.dashboard, op.expectedUpdatedAt)
      Object.assign(
        board.dashboard,
        op.op === "update-board" ? op.patch : { archived: op.archived }
      )
      board.dashboard.updatedAt = now
    } else if (op.op === "update-section") {
      const column = next.boards
        .flatMap((b) => b.columns)
        .find((c) => c.id === op.id && !c.deletedAt)
      checkRevision(column, op.expectedUpdatedAt)
      Object.assign(column!, op.patch, { updatedAt: now })
    } else if (op.op === "create-mirror") {
      cardById(op.mirror.sourceCardId)
      const board = boardById(op.boardId)
      newId(op.mirror.id)
      board.dashboard.mirrors = [...(board.dashboard.mirrors ?? []), op.mirror]
      board.dashboard.updatedAt = now
    } else if (op.op === "move-mirror" || op.op === "remove-mirror") {
      const board = boardById(op.boardId)
      checkRevision(board.dashboard, op.expectedUpdatedAt)
      const mirror = board.dashboard.mirrors?.find((m) => m.id === op.id)
      if (!mirror) throw new Error("Mirror is unavailable")
      if (op.op === "move-mirror") Object.assign(mirror, op.patch)
      else
        board.dashboard.mirrors = board.dashboard.mirrors!.filter(
          (m) => m.id !== op.id
        )
      board.dashboard.updatedAt = now
    } else if (op.op === "save-template") {
      if (
        builtinTemplates.some((t) => t.id === op.template.id) ||
        sidebar.templates?.some((t) => t.id === op.template.id)
      )
        throw new Error("Template ID conflict")
      sidebar.templates = [...(sidebar.templates ?? []), op.template]
    } else if (op.op === "apply-template") {
      const board = boardById(op.boardId),
        template = [...builtinTemplates, ...(sidebar.templates ?? [])].find(
          (t) => t.id === op.templateId
        )
      if (!template) throw new Error("Template is unavailable")
      if (board.columns.length || board.cards.length)
        throw new Error("Apply templates only to empty boards")
      const builtIn = template.id.startsWith("builtin-")
      board.columns = template.sections.map((section) =>
        ColumnSchema.parse({
          id: newId(freshId()),
          title: builtIn ? t(section.title) : section.title,
          color: section.color,
          done: section.done,
          dashboardId: board.dashboard.id,
          position: "a0",
          updatedAt: now,
          deletedAt: null,
        })
      )
      let previous: string | null = null
      board.columns.forEach((c) => {
        c.position = generateKeyBetween(previous, null)
        previous = c.position
      })
      board.dashboard.layout = initialLayout(board.columns, template.mode)
      let templateStageIds = new Map<string, string>(),
        templateStateIds = new Map<string, string>()
      const templateSectionIds = new Map(
        template.sections.map((s, i) => [s.sourceId ?? "", board.columns[i].id])
      )
      if (template.layout) {
        const blueprint = validateLayout(template.layout),
          sourceIds = template.sections.map((section) => section.sourceId)
        if (
          sourceIds.some((id) => !id) ||
          new Set(sourceIds).size !== sourceIds.length
        )
          throw new Error("Template section mapping is invalid")
        const sectionIds = new Map(
          sourceIds.map((id, i) => [id!, board.columns[i].id])
        )
        const axisIds = {
          lanes: new Map<string, string>(),
          stages: new Map<string, string>(),
          states: new Map<string, string>(),
        }
        for (const axis of ["lanes", "stages", "states"] as const)
          for (const item of blueprint[axis])
            axisIds[axis].set(
              item.id,
              axis === "stages" && sectionIds.has(item.id)
                ? sectionIds.get(item.id)!
                : newId(freshId())
            )
        templateStageIds = axisIds.stages
        templateStateIds = axisIds.states
        const layout = structuredClone(blueprint)
        layout.mode = template.mode
        for (const axis of ["lanes", "stages", "states"] as const)
          layout[axis] = layout[axis].map((item) => ({
            ...item,
            id: axisIds[axis].get(item.id)!,
            title: builtIn ? t(item.title) : item.title,
          }))
        layout.sections = Object.fromEntries(
          sourceIds.map((sourceId, i) => {
            const section = blueprint.sections[sourceId!]
            if (!section) throw new Error("Template section mapping is invalid")
            return [
              board.columns[i].id,
              {
                ...section,
                laneId: axisIds.lanes.get(section.laneId)!,
                stageId: axisIds.stages.get(section.stageId)!,
                stateId: axisIds.states.get(section.stateId)!,
              },
            ]
          })
        )
        board.dashboard.layout = validateLayout(layout)
      }
      if (builtIn && template.mode === "matrix")
        board.dashboard.layout.states.push(
          { id: newId(freshId()), title: t("Заморожено"), done: false },
          { id: newId(freshId()), title: t("Закрыто"), done: true }
        )
      board.columns.forEach((c, i) => {
        board.dashboard.layout!.sections[c.id].progressMode =
          template.sections[i].progressMode
      })
      const metricIds = new Map(
        (template.goalPath?.metrics ?? []).map((m) => [m.id, newId(freshId())])
      )
      if (template.goalPath)
        board.dashboard.goalPath = {
          ...structuredClone(template.goalPath),
          manualProgress: null,
          steps: template.goalPath.steps.map((s) => {
            const id = templateStageIds.get(s.id)
            if (!id) throw new Error("Template Goal step mapping is invalid")
            return { ...s, id, status: "not-started", skipped: false }
          }),
          metrics: template.goalPath.metrics.map((m) => ({
            ...m,
            id: metricIds.get(m.id)!,
            current: null,
            history: [],
          })),
          metricId: template.goalPath.metricId
            ? metricIds.get(template.goalPath.metricId)
            : undefined,
        }
      board.dashboard.fieldDefinitions = template.fields.map((f) => ({
        ...f,
        id: newId(freshId()),
      }))
      board.dashboard.updatedAt = now
      if (op.includeExamples)
        for (const example of template.examples) {
          const section = board.columns[example.section]
          if (!section) throw new Error("Invalid template example section")
          board.cards.push(
            CardSchema.parse({
              id: newId(freshId()),
              title: builtIn ? t(example.title) : example.title,
              body: builtIn ? t(example.body) : example.body,
              automationRules: op.includeAutomation
                ? example.automationRules?.map((rule) => {
                    const copy = structuredClone(rule),
                      action = copy.action,
                      condition = copy.condition
                    copy.id = freshId()
                    copy.revision = 1
                    if (action.type === "move-section")
                      action.columnId =
                        templateSectionIds.get(action.columnId) ?? ""
                    if (action.type === "set-stage")
                      action.stageId =
                        templateStageIds.get(action.stageId) ?? ""
                    if (action.type === "set-state")
                      action.stateId =
                        templateStateIds.get(action.stateId) ?? ""
                    if (action.type === "complete-goal-step")
                      action.stepId = templateStageIds.get(action.stepId) ?? ""
                    if (condition.type === "metric-target")
                      condition.metricId =
                        metricIds.get(condition.metricId) ?? ""
                    validateRuleTarget(
                      {
                        dashboards: [board.dashboard],
                        columns: board.columns,
                        cards: board.cards,
                      },
                      board.dashboard,
                      copy
                    )
                    return copy
                  })
                : undefined,
              columnId: section.id,
              position: appendRank(
                board.cards.filter((c) => c.columnId === section.id)
              ),
              updatedAt: now,
              deletedAt: null,
            })
          )
        }
    }
  }
  next.workspace.sidebar.updatedAt = now
  // Reject before synchronization so malformed cycles/configuration cannot reach a write.
  validateDocument(next)
  const model = {
    archivedBoardIds: archivedAutomationBoards(
      next.boards.map((b) => b.dashboard),
      sidebar
    ),
    dashboards: next.boards.map((b) => b.dashboard),
    columns: next.boards.flatMap((b) => b.columns),
    cards: next.boards.flatMap((b) => b.cards),
  }
  const derived = reconcileAutomation(
    model,
    now,
    model.dashboards.map((b) => b.id)
  )
  for (const board of next.boards) {
    const updated = derived.dashboards.find((b) => b.id === board.dashboard.id)
    if (updated) board.dashboard = { ...updated, updatedAt: now }
  }
  for (const event of derived.events)
    next.workspace.history.push({
      id: newId(freshId()),
      boardId: event.boardId,
      entityId: event.cardId,
      entityType: "card",
      action: "edit",
      userId: null,
      data: { ...event, explanation: event.reason, reason: "automation" },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  for (const board of next.boards)
    board.cards = board.cards.map((card) => {
      const replacement = derived.cards.find((c) => c.id === card.id)
      return replacement ? { ...replacement, updatedAt: now } : card
    })
  for (const move of derived.moves) {
    const moved = model.cards.find((c) => c.id === move.cardId)!,
      parent = model.columns.find(
        (c) => c.id === (move.columnId ?? moved.columnId)
      )!
    next.workspace.history.push({
      id: newId(freshId()),
      boardId: parent.dashboardId,
      entityId: move.cardId,
      entityType: "card",
      action: "move",
      userId: null,
      data: { reason: "linked-board-progress", ...move },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  }
  const oldCards = new Map(
      document.boards
        .flatMap((board) => board.cards)
        .map((card) => [card.id, card])
    ),
    oldColumns = new Map(
      document.boards
        .flatMap((board) => board.columns)
        .map((column) => [column.id, column])
    )
  for (const card of next.boards.flatMap((board) => board.cards)) {
    const before = oldCards.get(card.id)
    const groups = new Set(
      (Object.keys(CARD_FIELD_GROUP) as (keyof typeof CARD_FIELD_GROUP)[])
        .filter(
          (field) =>
            !before ||
            JSON.stringify(before[field]) !== JSON.stringify(card[field])
        )
        .map((field) => CARD_FIELD_GROUP[field])
    )
    if (groups.size) {
      card.stamps = Object.fromEntries(
        CARD_GROUPS.map((group) => [
          group,
          groups.has(group)
            ? now
            : (before?.stamps[group] ?? before?.updatedAt ?? now),
        ])
      )
      card.updatedAt = now
    }
  }
  for (const column of next.boards.flatMap((board) => board.columns)) {
    const before = oldColumns.get(column.id)
    const groups = new Set(
      (Object.keys(COLUMN_FIELD_GROUP) as (keyof typeof COLUMN_FIELD_GROUP)[])
        .filter(
          (field) =>
            !before ||
            JSON.stringify(before[field]) !== JSON.stringify(column[field])
        )
        .map((field) => COLUMN_FIELD_GROUP[field])
    )
    if (groups.size) {
      column.stamps = Object.fromEntries(
        COLUMN_GROUPS.map((group) => [
          group,
          groups.has(group)
            ? now
            : (before?.stamps[group] ?? before?.updatedAt ?? now),
        ])
      )
      column.updatedAt = now
    }
  }
  for (const card of next.boards.flatMap((b) => b.cards)) {
    if (
      card.deadline &&
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
        card.deadline
      )
    )
      throw new Error("Invalid deadline")
  }
  if (next.calendar)
    validateCalendarLinks(
      next.calendar,
      {
        dashboards: next.boards.map((b) => b.dashboard),
        columns: next.boards.flatMap((b) => b.columns),
        cards: next.boards.flatMap((b) => b.cards),
        sidebar: next.workspace?.sidebar,
      },
      new Set(
        changeset.operations.flatMap((op) =>
          op.op === "create-calendar-event"
            ? [op.event.id]
            : op.op === "update-calendar-event" &&
                op.event.links.some(
                  (l) =>
                    !document.calendar?.events
                      .find((e) => e.id === op.id)
                      ?.links.some(
                        (old) => JSON.stringify(old) === JSON.stringify(l)
                      )
                )
              ? [op.id]
              : []
        )
      )
    )
  return validateDocument(next)
}

/** Preserve consumed events when a whole command is undone through a snapshot. */
function restoreWithConsumedEvents(
  target: BordenaDocument,
  current: BordenaDocument
): BordenaDocument {
  const next = structuredClone(target),
    currentCards = new Map(
      current.boards.flatMap((b) => b.cards).map((c) => [c.id, c])
    )
  if (next.calendar)
    for (const event of next.calendar.events) {
      const latest = current.calendar?.events.find((e) => e.id === event.id)
      if (latest?.execution)
        event.execution = {
          ...latest.execution,
          key: `${event.start}/${event.end}`,
        }
    }
  let consumed = false
  for (const board of next.boards)
    for (const card of board.cards) {
      const states = currentCards
        .get(card.id)
        ?.automationState?.filter((s) =>
          card.automationRules?.some((r) => r.id === s.ruleId)
        )
      if (states?.length) {
        card.automationState = structuredClone(states)
        consumed = true
      }
    }
  if (!consumed) return next
  const model = {
    dashboards: next.boards.map((b) => b.dashboard),
    columns: next.boards.flatMap((b) => b.columns),
    cards: next.boards.flatMap((b) => b.cards),
  }
  const now = stamp(),
    rebased = new Map(
      rebaseAutomationAfterUndo(model, now).map((c) => [c.id, c])
    )
  for (const board of next.boards)
    board.cards = board.cards.map((c) => {
      const updated = rebased.get(c.id)
      return updated
        ? {
            ...updated,
            updatedAt: now,
            stamps: { ...updated.stamps, automation: now },
          }
        : c
    })
  next.schemaVersion = next.calendar ? 6 : 5
  next.workspace ??= { history: [] }
  const known = new Set(next.workspace.history.map((h) => h.id)),
    boards = new Set(next.boards.map((b) => b.dashboard.id)),
    cards = new Set(model.cards.map((c) => c.id))
  next.workspace.history.push(
    ...(current.workspace?.history ?? []).filter(
      (h) =>
        h.data.reason === "automation" &&
        !known.has(h.id) &&
        boards.has(h.boardId) &&
        cards.has(h.entityId)
    )
  )
  return next
}

let latestUndo: { backup: BackupRecord; token: string } | undefined
async function refresh(): Promise<void> {
  await webDb.bindEpoch()
  requestLinkedSync()
  await queryClient.invalidateQueries()
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("bordena:workspace-command"))
}
export async function applyChangeset(
  input: unknown,
  options: { internal?: boolean } = {}
): Promise<{ status: "applied" | "duplicate"; operations: number }> {
  await flushCardEdits()
  const parsed = ChangesetSchema.parse(input),
    bytes = new TextEncoder().encode(JSON.stringify(parsed))
  if (bytes.length > MAX_JSON_BYTES)
    throw new Error("Changeset exceeds size limit")
  const digest = await sha256(bytes),
    { payload: original, preview: expected } =
      await exportWorkspaceWithPreview(),
    entries = options.internal ? [] : ledger(original.document)
  const seen = entries.find((x) => x.id === parsed.id)
  if (seen) {
    if (seen.sha256 !== digest)
      throw new Error("Changeset ID reused with different content")
    return { status: "duplicate", operations: 0 }
  }
  if (entries.length >= 10000) throw new Error("Changeset ledger limit reached")
  const next = planChangeset(original.document, parsed, stamp())
  if (!options.internal)
    next.extensions = {
      ...next.extensions,
      appliedChangesets: [...entries, { id: parsed.id, sha256: digest }],
    }
  const result = await applyPlannedDocument(next, expected, {
    checkpoint: !options.internal,
    reason: parsed.title ?? "Bordena Changeset",
  })
  if (!options.internal)
    latestUndo = { backup: result.backup!, token: result.token }
  const signature = (doc: BordenaDocument) => {
    const ordered = <T extends { id: string }>(items: T[]) =>
      [...items].sort((a, b) => a.id.localeCompare(b.id))
    return JSON.stringify({
      boards: [...doc.boards]
        .sort((a, b) => a.dashboard.id.localeCompare(b.dashboard.id))
        .map((board) => ({
          ...board,
          columns: ordered(board.columns),
          cards: ordered(board.cards),
        })),
      organization: doc.organization,
      workspace: {
        history: ordered(doc.workspace?.history ?? []),
        sidebar: {
          items: doc.workspace?.sidebar?.items ?? [],
          templates: doc.workspace?.sidebar?.templates ?? [],
        },
      },
      preferences: doc.preferences,
      calendar: doc.calendar,
      extensions: doc.extensions,
      attachmentsManifest: [...doc.attachmentsManifest].sort((a, b) =>
        a.path.localeCompare(b.path)
      ),
    })
  }
  const restore = async (
    expectedDocument: BordenaDocument,
    targetDocument: BordenaDocument
  ) => {
    const current = await exportWorkspaceWithPreview()
    if (signature(current.payload.document) !== signature(expectedDocument))
      throw new Error(
        "Data changed after this command; restore its backup explicitly"
      )
    await applyImport(
      {
        document: restoreWithConsumedEvents(
          targetDocument,
          current.payload.document
        ),
        files: original.files,
      },
      "replace",
      current.preview
    )
    await refresh()
    return (await exportWorkspaceWithPreview()).payload.document
  }
  let undoExpected = next,
    redoExpected = original.document
  const deltaOnly =
    options.internal &&
    parsed.operations.every((op) =>
      [
        "link-board",
        "move-mirror",
        "remove-mirror",
        "update-board",
        "configure-section",
        "update-project",
        "update-workspace",
        "configure-goal-path",
        "reorder-goal-steps",
        "set-goal-metric",
        "record-measurement",
        "upsert-rule",
        "remove-rule",
        "set-rule-enabled",
        "set-deadline-action",
      ].includes(op.op)
    )
  if (
    options.internal &&
    next.calendar &&
    parsed.operations.every((op) =>
      [
        "create-calendar",
        "update-calendar",
        "create-calendar-event",
        "update-calendar-event",
        "cancel-calendar-event",
        "update-calendar-instance",
        "upsert-availability",
      ].includes(op.op)
    )
  )
    recordCalendarCommand(
      original.document.calendar,
      next.calendar,
      parsed.title
    )
  else if (deltaOnly) recordStructuralBatch(result.writes)
  else
    recordCommand({
      label: parsed.title,
      undo: async () => {
        redoExpected = await restore(undoExpected, original.document)
      },
      redo: async () => {
        undoExpected = await restore(redoExpected, next)
      },
    })
  await refresh()
  await pruneAutomaticBackups()
  return { status: "applied", operations: parsed.operations.length }
}
/** A whole changeset is undoable only while its checkpoint still matches current content. */
export async function undoChangeset(): Promise<void> {
  if (!latestUndo) throw new Error("No changeset checkpoint in this session")
  const { preview: expected, payload: current } =
    await exportWorkspaceWithPreview()
  if (expected.token !== latestUndo.token)
    throw new Error(
      "Data changed after the changeset; restore its backup explicitly"
    )
  const previous = await readBackup(latestUndo.backup)
  await applyImport(
    {
      ...previous,
      document: restoreWithConsumedEvents(previous.document, current.document),
    },
    "replace",
    expected
  )
  latestUndo = undefined
  resetStructuralHistory()
  await refresh()
}
export async function applyOperations(
  operations: Operation[],
  title?: string
): Promise<void> {
  await applyChangeset(
    {
      format: "bordena-changeset",
      schemaVersion: 1,
      id: crypto.randomUUID(),
      title,
      operations,
    },
    { internal: true }
  )
}
export async function setCardBoardLink(
  card: Card,
  link: Card["boardLink"]
): Promise<void> {
  await applyOperations([
    {
      op: "link-board",
      id: card.id,
      expectedUpdatedAt: card.updatedAt,
      link: link ?? null,
    },
  ])
}
