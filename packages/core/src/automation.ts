import type {
  AutomationRule,
  AutomationExecution,
  Card,
  Dashboard,
  SidebarLayout,
} from "@bordena/contract"
import { generateKeyBetween } from "fractional-indexing"
import { deadlineInstant } from "@bordena/utils"
import { cardAxes, isCardCompleted } from "./board-layout"
import { metricProgress, setGoalStep } from "./goal-path"
import {
  linkedProgress,
  synchronizeLinks,
  type LinkedModel,
} from "./linked-boards"

export interface AutomationEvent {
  cardTitle: string
  from?: string
  to?: string
  cardId: string
  boardId: string
  ruleId: string
  ruleTitle: string
  condition: AutomationRule["condition"]
  action: AutomationRule["action"]
  result: AutomationExecution["result"]
  reason: string
  eventKey: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export function validateRuleTarget(
  model: LinkedModel,
  board: Dashboard,
  rule: AutomationRule
): void {
  const action = rule.action
  if (
    action.type === "move-section" &&
    !model.columns.some(
      (c) =>
        c.id === action.columnId &&
        c.dashboardId === board.id &&
        c.deletedAt === null
    )
  )
    throw new Error("Target section is unavailable")
  if (
    action.type === "set-stage" &&
    !board.layout?.stages.some((s) => s.id === action.stageId)
  )
    throw new Error("Target stage is unavailable")
  if (
    action.type === "set-state" &&
    !board.layout?.states.some((s) => s.id === action.stateId)
  )
    throw new Error("Target state is unavailable")
  if (
    action.type === "complete-goal-step" &&
    !board.goalPath?.steps.some((s) => s.id === action.stepId)
  )
    throw new Error("Target Goal step is unavailable")
  const condition = rule.condition
  if (
    condition.type === "metric-target" &&
    !board.goalPath?.metrics.some((m) => m.id === condition.metricId)
  )
    throw new Error("Goal metric is unavailable")
}
function conditionValue(
  model: LinkedModel,
  board: Dashboard,
  card: Card,
  rule: AutomationRule,
  now: number
): boolean {
  const condition = rule.condition
  switch (condition.type) {
    case "deadline": {
      const instant = card.deadline ? deadlineInstant(card.deadline) : null
      return instant !== null && instant <= now
    }
    case "checklist-complete": {
      // Fenced examples are prose, not tasks. An empty checklist is never complete.
      const body = card.body.replace(
        /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[^\n]*(?=\n|$)/g,
        ""
      )
      const tasks = [...body.matchAll(/^\s*[-*+]\s+\[([ xX])\]\s+.+$/gm)]
      return tasks.length > 0 && tasks.every((m) => m[1].toLowerCase() === "x")
    }
    case "progress-complete":
      return (
        (card.boardLink && card.boardLink.mode !== "navigation"
          ? linkedProgress(model, card.boardLink).value
          : card.progress) === 100
      )
    case "goal-complete":
      return (
        !!board.goalPath?.steps.some((s) => s.required) &&
        board.goalPath.steps
          .filter((s) => s.required)
          .every((s) => s.status === "completed")
      )
    case "metric-target": {
      const metric = board.goalPath?.metrics.find(
        (m) => m.id === condition.metricId
      )
      return !!metric && metricProgress(metric) === 100
    }
    case "linked-range": {
      const value = card.boardLink
        ? linkedProgress(model, card.boardLink).value
        : null
      return value !== null && value >= condition.min && value <= condition.max
    }
  }
}
function actionField(rule: AutomationRule): string {
  switch (rule.action.type) {
    case "move-section":
      return "columnId"
    case "set-stage":
      return "stageId"
    case "set-state":
      return "stateId"
    case "set-progress":
      return "progress"
    case "complete-goal-step":
      return `step:${rule.action.stepId}`
    case "history":
      return `history:${rule.id}`
  }
}
function actionValue(rule: AutomationRule): unknown {
  const a = rule.action
  return a.type === "move-section"
    ? a.columnId
    : a.type === "set-stage"
      ? a.stageId
      : a.type === "set-state"
        ? a.stateId
        : a.type === "set-progress"
          ? a.value
          : a.type === "complete-goal-step"
            ? "completed"
            : a.message
}

/** One immutable condition snapshot. Execution consumption and effects commit together. */
export function planAutomation(
  model: LinkedModel,
  now: number,
  affected?: Set<string>
): { cards: Card[]; dashboards: Dashboard[]; events: AutomationEvent[] } {
  const boards = new Map(model.dashboards.map((b) => [b.id, b]))
  const columns = new Map(model.columns.map((c) => [c.id, c]))
  const cards = new Map<string, Card>(),
    dashboards = new Map<string, Dashboard>(),
    events: AutomationEvent[] = []
  const candidates: {
    card: Card
    board: Dashboard
    rule: AutomationRule
    state: AutomationExecution
    field: string
    value: unknown
    reason?: AutomationExecution["result"]
  }[] = []
  const updateState = (card: Card, state: AutomationExecution) => {
    const next = cards.get(card.id) ?? card
    cards.set(card.id, {
      ...next,
      automationState: [
        ...(next.automationState ?? []).filter(
          (s) => s.ruleId !== state.ruleId
        ),
        state,
      ],
    })
  }
  for (const card of model.cards) {
    const column = columns.get(card.columnId),
      board = boards.get(column?.dashboardId ?? "")
    if (
      card.deletedAt !== null ||
      !board ||
      board.deletedAt !== null ||
      (affected && !affected.has(board.id))
    )
      continue
    for (const rule of [...(card.automationRules ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id)
    )) {
      if (!rule.enabled || rule.paused) continue
      const signature = JSON.stringify([
        rule,
        rule.condition.type === "deadline" ? card.deadline : null,
      ])
      const old = card.automationState?.find((s) => s.ruleId === rule.id)
      const satisfied = conditionValue(model, board, card, rule, now)
      if (old?.signature === signature && old.satisfied === satisfied) continue
      if (!satisfied && !old) continue
      const state: AutomationExecution = {
        ruleId: rule.id,
        cardId: card.id,
        signature,
        satisfied,
        generation: (old?.generation ?? 0) + (satisfied ? 1 : 0),
        at: now,
        result: "armed",
        reason: "Condition is not satisfied",
      }
      if (!satisfied) {
        updateState(card, state)
        continue
      }
      state.eventKey = `${card.id}:${rule.id}:${state.generation}:${signature}`
      const reason =
        (board.archived ||
          card.archived ||
          model.archivedBoardIds?.includes(board.id)) &&
        !rule.includeArchived
          ? "skipped-archived"
          : isCardCompleted(card, column, board.layout) &&
              !rule.includeCompleted
            ? "skipped-complete"
            : undefined
      candidates.push({
        card,
        board,
        rule,
        state,
        field: actionField(rule),
        value: actionValue(rule),
        reason,
      })
    }
  }
  if (candidates.length > 1000)
    throw new Error("Automation operation limit exceeded; split this update")
  // Reserve all targets from the same snapshot, including persistent linked-move rules.
  const targets = new Map<string, Set<string>>()
  const reserve = (key: string, value: unknown) => {
    const values = targets.get(key) ?? new Set()
    values.add(JSON.stringify(value))
    targets.set(key, values)
  }
  for (const c of candidates.filter((c) => !c.reason))
    reserve(
      `${c.field.startsWith("step:") ? c.board.id : c.card.id}:${c.field}`,
      c.value
    )
  for (const card of model.cards)
    if (card.boardLink?.mode === "auto-move") {
      const owner = boards.get(columns.get(card.columnId)?.dashboardId ?? "")
      if (
        card.archived ||
        owner?.archived ||
        (owner && model.archivedBoardIds?.includes(owner.id))
      )
        continue
      const value = linkedProgress(model, card.boardLink).value
      const range =
        value === null
          ? undefined
          : card.boardLink.rules.find((r) => value >= r.min && value <= r.max)
      if (range) {
        reserve(`${card.id}:stageId`, range.stageId)
        if (range.columnId) reserve(`${card.id}:columnId`, range.columnId)
      }
    }
  for (const c of candidates.sort(
    (a, b) =>
      a.card.id.localeCompare(b.card.id) || a.rule.id.localeCompare(b.rule.id)
  )) {
    let card = cards.get(c.card.id) ?? c.card,
      board = dashboards.get(c.board.id) ?? c.board
    const before: Record<string, unknown> = {},
      after: Record<string, unknown> = {}
    let result: AutomationExecution["result"] = c.reason ?? "applied",
      reason: string = c.reason ?? "Condition satisfied"
    try {
      if (!c.reason) {
        validateRuleTarget(model, c.board, c.rule)
        if (
          (targets.get(
            `${c.field.startsWith("step:") ? c.board.id : c.card.id}:${c.field}`
          )?.size ?? 0) > 1
        ) {
          result = "conflict"
          reason = "Conflicting action targets"
        } else {
          const a = c.rule.action
          if (a.type === "complete-goal-step") {
            before.step = board.goalPath!.steps.find((s) => s.id === a.stepId)
            board = {
              ...board,
              goalPath: setGoalStep(board.goalPath!, a.stepId, "completed"),
            }
            after.step = board.goalPath!.steps.find((s) => s.id === a.stepId)
            if (!same(before, after)) dashboards.set(board.id, board)
          } else if (a.type !== "history") {
            before[c.field] = card[c.field as keyof Card]
            const patch: Partial<Card> = { [c.field]: c.value }
            if (a.type === "move-section" && card.columnId !== a.columnId) {
              if (board.layout)
                Object.assign(patch, cardAxes(card, board.layout))
              const last =
                [...model.cards, ...cards.values()]
                  .filter(
                    (x) =>
                      x.id !== card.id &&
                      x.deletedAt === null &&
                      x.columnId === a.columnId
                  )
                  .map((x) => x.position)
                  .sort()
                  .at(-1) ?? null
              patch.position = generateKeyBetween(last, null)
            }
            for (const key of Object.keys(patch))
              before[key] = card[key as keyof Card]
            card = { ...card, ...patch }
            for (const key of Object.keys(patch))
              after[key] = card[key as keyof Card]
            cards.set(card.id, card)
          } else {
            before.message = null
            after.message = a.message
          }
          if (same(before, after)) {
            result = "no-op"
            reason = "Target already reached"
          }
        }
      }
    } catch (error) {
      result = "missing-target"
      reason = error instanceof Error ? error.message : String(error)
    }
    updateState(card, { ...c.state, result, reason })
    const display = (values: Record<string, unknown>) => {
      const value = values[c.field],
        action = c.rule.action
      if (action.type === "complete-goal-step")
        return (values.step as { status?: string } | undefined)?.status
      if (value === undefined) return undefined
      if (action.type === "set-progress") return `${value}%`
      if (action.type === "move-section")
        return model.columns.find((x) => x.id === value)?.title ?? String(value)
      if (action.type === "set-stage")
        return (
          board.layout?.stages.find((x) => x.id === value)?.title ??
          String(value)
        )
      if (action.type === "set-state")
        return (
          board.layout?.states.find((x) => x.id === value)?.title ??
          String(value)
        )
      return String(value)
    }
    events.push({
      cardTitle: card.title,
      from: display(before),
      to: display(after),
      cardId: card.id,
      boardId: board.id,
      ruleId: c.rule.id,
      ruleTitle: c.rule.title,
      condition: c.rule.condition,
      action: c.rule.action,
      eventKey: c.state.eventKey!,
      result,
      reason,
      before,
      after,
    })
  }
  return {
    cards: [...cards.values()],
    dashboards: [...dashboards.values()],
    events,
  }
}

/** One scheduler per application, clamped to the host timer range. Expired events are caught at startup. */
export function nextAutomationDeadline(
  cards: Card[],
  now: number
): number | null {
  let nearest: number | null = null
  for (const c of cards)
    if (
      c.deletedAt === null &&
      c.deadline &&
      c.automationRules?.some(
        (r) => r.enabled && !r.paused && r.condition.type === "deadline"
      )
    ) {
      const at = deadlineInstant(c.deadline)
      if (at !== null && at > now && (nearest === null || at < nearest))
        nearest = at
    }
  return nearest
}

/** Pure bounded planning shared by Changeset and the live coordinator. No writes before convergence. */
export function reconcileAutomation(
  input: LinkedModel,
  now: number,
  affected: Iterable<string>
) {
  const model = {
    ...input,
    cards: [...input.cards],
    dashboards: [...input.dashboards],
  }
  let boards = new Set(affected)
  const events: AutomationEvent[] = [],
    moves: ReturnType<typeof synchronizeLinks>["moves"] = []
  const originalCards = new Map(input.cards.map((c) => [c.id, c])),
    originalBoards = new Map(input.dashboards.map((b) => [b.id, b]))
  const fired = new Set<string>()
  for (let wave = 0; wave < 8; wave++) {
    const derived = synchronizeLinks(model, boards)
    const linked = new Map(derived.cards.map((c) => [c.id, c]))
    model.cards = model.cards.map((c) => linked.get(c.id) ?? c)
    moves.push(...derived.moves)
    for (const card of derived.cards) {
      const board = model.columns.find(
        (c) => c.id === card.columnId
      )?.dashboardId
      if (board) boards.add(board)
    }
    const plan = planAutomation(model, now, boards)
    for (const event of plan.events) {
      const key = `${event.cardId}:${event.ruleId}`
      if (fired.has(key))
        throw new Error("Automation cycle detected; no changes were saved")
      fired.add(key)
    }
    events.push(...plan.events)
    if (events.length + moves.length > 1000)
      throw new Error("Automation operation limit exceeded")
    const cards = new Map(plan.cards.map((c) => [c.id, c])),
      dashboards = new Map(plan.dashboards.map((b) => [b.id, b]))
    model.cards = model.cards.map((c) => cards.get(c.id) ?? c)
    model.dashboards = model.dashboards.map((b) => dashboards.get(b.id) ?? b)
    if (!derived.cards.length && !plan.cards.length && !plan.dashboards.length)
      return {
        cards: model.cards.filter((c) => !same(c, originalCards.get(c.id))),
        dashboards: model.dashboards.filter(
          (b) => !same(b, originalBoards.get(b.id))
        ),
        events,
        moves,
      }
    boards = new Set([...boards, ...plan.dashboards.map((b) => b.id)])
  }
  throw new Error("Automation wave limit exceeded; no changes were saved")
}

/** Undo rebases consumed events onto restored condition inputs, so undo never becomes a new trigger. */
export function rebaseAutomationAfterUndo(
  model: LinkedModel,
  now: number,
  touched?: Set<string>
): Card[] {
  const boards = new Map(model.dashboards.map((b) => [b.id, b]))
  const parents = new Map(model.columns.map((c) => [c.id, c.dashboardId]))
  return model.cards
    .filter((c) => c.automationState?.length)
    .flatMap((card) => {
      const board = boards.get(parents.get(card.columnId) ?? "")
      if (!board) return []
      const state = card.automationState!.map((state) => {
        const rule = card.automationRules?.find((r) => r.id === state.ruleId)
        if (!rule) return state
        const signature = JSON.stringify([
            rule,
            rule.condition.type === "deadline" ? card.deadline : null,
          ]),
          satisfied = conditionValue(model, board, card, rule, now)
        if (
          touched &&
          !touched.has(card.id) &&
          !touched.has(board.id) &&
          signature === state.signature &&
          satisfied === state.satisfied
        )
          return state
        return {
          ...state,
          signature,
          satisfied,
          result: "undone" as const,
          at: now,
          reason: "History restored; event remains consumed",
        }
      })
      return same(state, card.automationState)
        ? []
        : [{ ...card, automationState: state }]
    })
}

export function archivedAutomationBoards(
  dashboards: Dashboard[],
  sidebar?: SidebarLayout
): string[] {
  const projects = new Set(
    sidebar?.items.flatMap((i) =>
      i.type === "folder" && i.archived ? i.boardIds : []
    ) ?? []
  )
  const spaces = new Set(
    sidebar?.workspaces?.filter((w) => w.archived).map((w) => w.id) ?? []
  )
  return dashboards
    .filter(
      (b) =>
        b.archived ||
        projects.has(b.id) ||
        spaces.has(b.workspaceId ?? "default")
    )
    .map((b) => b.id)
}
