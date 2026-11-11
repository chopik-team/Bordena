import { z } from "zod"
import {
  BoardLinkSchema,
  BoardTemplateSchema,
  CardSchema,
  ColumnSchema,
  DashboardSchema,
  EntityIdSchema,
  MirrorSchema,
  GoalPathSchema,
  GoalMetricSchema,
  AutomationRuleSchema,
  AutomationActionSchema,
  CalendarSchema,
  CalendarEventSchema,
  AvailabilityProfileSchema,
} from "@bordena/contract"

const id = EntityIdSchema,
  revision = z.number().finite().nonnegative()
const title = z.string().min(1).max(4096)
// Defaults belong to creation. Missing patch fields must never reset existing content.
const cardPatch = z
  .object({
    title: CardSchema.shape.title.max(4096).optional(),
    body: CardSchema.shape.body.max(2 * 1024 * 1024).optional(),
    deadline: CardSchema.shape.deadline.removeDefault().optional(),
    priority: z.enum(["", "low", "medium", "high"]).optional(),
    tags: CardSchema.shape.tags.removeDefault().max(1000).optional(),
    color: CardSchema.shape.color,
    progress: CardSchema.shape.progress,
    stageId: CardSchema.shape.stageId,
    stateId: CardSchema.shape.stateId,
    boardLink: CardSchema.shape.boardLink,
    calendarId: CardSchema.shape.calendarId,
    fieldValues: CardSchema.shape.fieldValues,
    externalFiles: CardSchema.shape.externalFiles,
    archived: CardSchema.shape.archived,
  })
  .strict()
const columnPatch = z
  .object({
    title: ColumnSchema.shape.title.optional(),
    position: ColumnSchema.shape.position.optional(),
    color: ColumnSchema.shape.color.removeDefault().optional(),
    done: ColumnSchema.shape.done.removeDefault().optional(),
    collapsed: ColumnSchema.shape.collapsed.removeDefault().optional(),
  })
  .strict()
const boardPatch = DashboardSchema.pick({
  title: true,
  color: true,
  priority: true,
  deadline: true,
  progress: true,
  archived: true,
  fieldDefinitions: true,
  tableFields: true,
  defaultCalendarId: true,
})
  .partial()
  .strict()
const base = { id },
  existing = { id, expectedUpdatedAt: revision }
const OperationSchema = z.discriminatedUnion("op", [
  z
    .object({ op: z.literal("create-calendar"), calendar: CalendarSchema })
    .strict(),
  z
    .object({
      op: z.literal("update-calendar"),
      ...existing,
      calendar: CalendarSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("create-calendar-event"),
      event: CalendarEventSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("update-calendar-event"),
      ...existing,
      event: CalendarEventSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("cancel-calendar-event"),
      ...existing,
      instance: z.iso.date().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("update-calendar-instance"),
      ...existing,
      day: z.iso.date(),
      patch: CalendarEventSchema.shape.exceptions.unwrap().valueType,
    })
    .strict(),
  z
    .object({
      op: z.literal("upsert-availability"),
      profile: AvailabilityProfileSchema,
      expectedUpdatedAt: revision,
    })
    .strict(),
  z
    .object({
      op: z.literal("configure-goal-path"),
      ...existing,
      goalPath: GoalPathSchema,
      stages: z.array(z.object({ id, title }).strict()).max(1000).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("reorder-goal-steps"),
      ...existing,
      stepIds: z.array(id).max(1000),
    })
    .strict(),
  z
    .object({
      op: z.literal("set-goal-metric"),
      ...existing,
      metric: GoalMetricSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("record-measurement"),
      ...existing,
      metricId: id,
      measurement: z
        .object({
          id,
          date: CardSchema.shape.deadline.removeDefault().unwrap(),
          value: z.number().finite(),
        })
        .strict(),
      makeCurrent: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      op: z.literal("upsert-rule"),
      ...existing,
      rule: AutomationRuleSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove-rule"), ...existing, ruleId: id }).strict(),
  z
    .object({
      op: z.literal("set-rule-enabled"),
      ...existing,
      ruleId: id,
      enabled: z.boolean(),
      paused: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set-deadline-action"),
      ...existing,
      action: AutomationActionSchema.nullable(),
      includeCompleted: z.boolean().default(false),
      includeArchived: z.boolean().default(false),
    })
    .strict(),
  z.object({ op: z.literal("create-workspace"), ...base, title }).strict(),
  z
    .object({
      op: z.literal("create-project"),
      ...base,
      title,
      workspaceId: id,
    })
    .strict(),
  z
    .object({
      op: z.literal("update-project"),
      ...existing,
      patch: z
        .object({
          title: title.optional(),
          workspaceId: id.optional(),
          archived: z.boolean().optional(),
          deadline: DashboardSchema.shape.deadline,
          color: z.string().max(32).optional(),
          priority: DashboardSchema.shape.priority,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal("update-workspace"),
      ...existing,
      patch: z
        .object({ title: title.optional(), archived: z.boolean().optional() })
        .strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal("create-board"),
      ...base,
      title,
      workspaceId: id.optional(),
      projectId: id.optional(),
      mode: z.enum(["free", "matrix"]).default("free"),
    })
    .strict(),
  z
    .object({
      op: z.literal("create-section"),
      ...base,
      boardId: id,
      title,
      color: z.string().max(32).optional(),
      done: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("create-axis"),
      ...base,
      boardId: id,
      title,
      axis: z.enum(["lanes", "stages", "states"]),
      done: z.boolean().optional(),
      color: z.string().max(32).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("configure-section"),
      id,
      boardId: id,
      expectedUpdatedAt: revision,
      patch: z
        .object({
          laneId: id.optional(),
          stageId: id.optional(),
          stateId: id.optional(),
          position: z.string().max(256).optional(),
          collapsed: z.boolean().optional(),
          progressMode: z.enum(["off", "manual", "position"]).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal("create-card"),
      ...base,
      columnId: id,
      title,
      body: z
        .string()
        .max(2 * 1024 * 1024)
        .default(""),
      progress: z.number().min(0).max(100).nullable().optional(),
      deadline: z.string().nullable().optional(),
    })
    .strict(),
  z
    .object({ op: z.literal("update-card"), ...existing, patch: cardPatch })
    .strict(),
  z
    .object({ op: z.literal("update-board"), ...existing, patch: boardPatch })
    .strict(),
  z
    .object({
      op: z.literal("move-card"),
      ...existing,
      columnId: id.optional(),
      position: z.string().max(256).optional(),
      stageId: id.optional(),
      stateId: id.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("update-section"),
      ...existing,
      patch: columnPatch,
    })
    .strict(),
  z
    .object({
      op: z.literal("archive-board"),
      ...existing,
      archived: z.boolean(),
    })
    .strict(),
  z
    .object({
      op: z.literal("link-board"),
      ...existing,
      link: BoardLinkSchema.nullable(),
    })
    .strict(),
  z
    .object({
      op: z.literal("create-mirror"),
      boardId: id,
      mirror: MirrorSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("move-mirror"),
      boardId: id,
      ...existing,
      patch: MirrorSchema.pick({
        columnId: true,
        position: true,
        stageId: true,
        stateId: true,
      })
        .partial()
        .strict(),
    })
    .strict(),
  z
    .object({ op: z.literal("remove-mirror"), boardId: id, ...existing })
    .strict(),
  z
    .object({
      op: z.literal("apply-template"),
      boardId: id,
      templateId: id,
      includeExamples: z.boolean().default(false),
      includeAutomation: z.boolean().default(false),
    })
    .strict(),
  z
    .object({ op: z.literal("save-template"), template: BoardTemplateSchema })
    .strict(),
])
export const ChangesetSchema = z
  .object({
    format: z.literal("bordena-changeset"),
    schemaVersion: z.literal(1),
    id,
    title: z.string().max(4096).optional(),
    operations: z.array(OperationSchema).min(1).max(5000),
  })
  .strict()
export type Changeset = z.infer<typeof ChangesetSchema>
export type Operation = z.infer<typeof OperationSchema>
export type Template = z.infer<typeof BoardTemplateSchema>
export const builtinTemplates: Template[] = [
  [
    "video",
    "Видеопроизводство",
    "YouTube",
    ["Идеи", "Сценарий", "Запись", "Монтаж", "Публикация"],
  ],
  [
    "content",
    "Контент-план",
    "Контент",
    ["Идеи", "Подготовка", "Проверка", "Опубликовано"],
  ],
  [
    "software",
    "Разработка ПО",
    "Разработка",
    ["Backlog", "План", "Разработка", "Проверка", "Готово"],
  ],
  [
    "bugs",
    "Баг-трекинг",
    "Разработка",
    ["Новые", "Подтверждено", "Исправление", "Проверено"],
  ],
  [
    "games",
    "Разработка игр",
    "Игры",
    ["Концепция", "Прототип", "Производство", "Тестирование", "Готово"],
  ],
  [
    "music",
    "Музыкальное производство",
    "Музыка",
    ["Идеи", "Аранжировка", "Запись", "Сведение", "Мастеринг"],
  ],
  ["study", "Учёба", "Учёба", ["Материалы", "Изучаю", "Практика", "Освоено"]],
  ["personal", "Личные задачи", "Личное", ["Планы", "Сегодня", "Готово"]],
  ["free", "Свободная доска", "Универсальное", ["Планы", "Работа", "Готово"]],
  [
    "matrix",
    "Матричное планирование",
    "Универсальное",
    ["План", "Работа", "Готово"],
  ],
].map(([key, name, category, sections]) => ({
  id: `builtin-${key}`,
  title: name as string,
  category: category as string,
  mode: key === "matrix" ? "matrix" : "free",
  sections: (sections as string[]).map((name, i, all) => ({
    title: name,
    color: ["blue", "violet", "green"][i % 3],
    done: i === all.length - 1,
    progressMode: "off",
  })),
  fields: [],
  examples: [
    {
      title: "Первая задача",
      body: "Опишите результат и следующий шаг.",
      section: 0,
    },
  ],
}))

// Goal variants extend the same catalog; their stages are ordinary board axes.
const goalBlueprints: [string, string, string, string[]][] = [
  [
    "personal-goal",
    "Личная цель",
    "Личное",
    ["Старт", "Мой следующий шаг", "Результат"],
  ],
  ["habit", "Привычка", "Личное", ["Подготовка", "Практика", "Закрепление"]],
  [
    "activity",
    "Физическая активность",
    "Личное",
    ["Мой старт", "Мой план", "Мой результат"],
  ],
  [
    "long-personal",
    "Долгосрочный проект",
    "Личное",
    ["Замысел", "Подготовка", "Промежуточная цель", "Результат"],
  ],
  [
    "exam",
    "Подготовка к экзамену",
    "Учёба",
    ["Материалы", "План подготовки", "Практика", "Экзамен"],
  ],
  [
    "skill",
    "Освоение навыка",
    "Учёба",
    ["Старт", "Изучение", "Практика", "Мой результат"],
  ],
  [
    "course",
    "Прохождение курса",
    "Учёба",
    ["Материалы", "Обучение", "Практика", "Итог"],
  ],
  [
    "curriculum",
    "Учебная программа",
    "Учёба",
    ["Цели обучения", "Модули", "Практика", "Итог"],
  ],
  [
    "youtube",
    "YouTube-видео",
    "Контент",
    ["Идея", "Сценарий", "Запись", "Монтаж", "Публикация"],
  ],
  [
    "series",
    "Серия видеороликов",
    "Контент",
    ["Концепция", "План серии", "Производство", "Публикация"],
  ],
  [
    "content-plan",
    "Контент-проект",
    "Контент",
    ["Замысел", "Подготовка", "Создание", "Публикация"],
  ],
  [
    "film",
    "Фильм",
    "Контент",
    ["Замысел", "Сценарий", "Съёмка", "Монтаж", "Премьера"],
  ],
  [
    "app",
    "Приложение",
    "Разработка",
    ["Задача", "Прототип", "Разработка", "Проверка", "Релиз"],
  ],
  [
    "release",
    "Релиз ПО",
    "Разработка",
    ["План релиза", "Разработка", "Тестирование", "Выпуск"],
  ],
  [
    "fixes",
    "Исправление ошибок",
    "Разработка",
    ["Воспроизведение", "Причина", "Исправление", "Проверка"],
  ],
  [
    "game",
    "Игра",
    "Игры",
    ["Концепция", "Прототип", "Производство", "Тестирование", "Релиз"],
  ],
  [
    "track",
    "Музыкальный трек",
    "Музыка",
    ["Идея", "Аранжировка", "Запись", "Сведение", "Мастеринг"],
  ],
  [
    "recording",
    "Запись и сведение",
    "Музыка",
    ["Подготовка", "Запись", "Редактирование", "Сведение"],
  ],
  [
    "music-release",
    "Музыкальный релиз",
    "Музыка",
    ["Концепция", "Производство", "Мастеринг", "Выпуск"],
  ],
]
for (const [key, title, category, names] of goalBlueprints) {
  const stages = names.map((title, i) => ({ id: `goal-stage-${i}`, title }))
  builtinTemplates.push({
    id: `builtin-goal-${key}`,
    title,
    category,
    mode: "free",
    sections: [
      {
        sourceId: "goal-tasks",
        title: "Карточки",
        color: "blue",
        done: false,
        progressMode: "manual",
      },
    ],
    layout: {
      schemaVersion: 1,
      mode: "free",
      lanes: [{ id: "goal-lane", title: "Столбец" }],
      stages,
      states: [
        { id: "goal-active", title: "В работе", done: false },
        { id: "goal-done", title: "Готово", done: true },
      ],
      sections: {
        "goal-tasks": {
          laneId: "goal-lane",
          stageId: stages[0].id,
          stateId: "goal-active",
          progressMode: "manual",
        },
      },
    },
    goalPath: {
      schemaVersion: 1,
      progressMode: "stages",
      steps: stages.map((s) => ({
        id: s.id,
        status: "not-started",
        required: true,
      })),
      metrics: [],
    },
    fields: [],
    examples: [
      {
        title: "Первый шаг к цели",
        body: "Опишите результат и следующий шаг.",
        section: 0,
        automationRules: [
          {
            id: "example-checklist",
            title: "Чек-лист завершён",
            revision: 1,
            enabled: true,
            paused: false,
            condition: { type: "checklist-complete" },
            action: { type: "history", message: "Чек-лист завершён" },
          },
        ],
      },
    ],
  })
}

export const changesetJsonSchema = () =>
  z.toJSONSchema(ChangesetSchema, { target: "draft-2020-12", io: "input" })
