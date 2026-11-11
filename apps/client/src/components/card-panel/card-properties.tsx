import { useT } from "@bordena/i18n"
import {
  useCard,
  useCardCol,
  useDashboards,
  useUpdateCard,
  cardAxes,
  useBoard,
  sectionProgressValues,
  useMoveCardToColumn,
} from "@bordena/core"
import { ColorSelect } from "../column/column-color"
import { ProgressField } from "../progress-field"
import { DateInput, formatDeadline } from "@bordena/ui-kit"
export function CardProperties({ cardId }: { cardId: string }) {
  const t = useT()
  const { data: card } = useCard(cardId)
  const { data: col } = useCardCol(cardId)
  const { data: boards = [] } = useDashboards()
  const { data: board } = useBoard(col?.dashboardId ?? "")
  const { mutate: update } = useUpdateCard(cardId)
  const { mutate: moveToSection } = useMoveCardToColumn()
  const layout = boards.find((b) => b.id === col?.dashboardId)?.layout
  if (!card) return null
  const axes = layout ? cardAxes(card, layout) : null
  const mode = layout?.sections[card.columnId]?.progressMode ?? "off"
  const positional =
    mode === "position"
      ? sectionProgressValues(board?.cards ?? [], layout).get(card.id)
      : null
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <label className="flex items-center gap-2 text-sm">
        {t("Цвет карточки")}
        <ColorSelect
          label={t("Цвет карточки")}
          value={card.color}
          onChange={(color) => update({ color })}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {t("Дата и время срока")}
        <DateInput
          withTime
          value={card.deadline}
          onChange={(deadline) => update({ deadline })}
          inputProps={{ "aria-label": t("Дата и время срока") }}
          className="rounded border px-3 py-2 hover:bg-accent"
        >
          {card.deadline ? formatDeadline(card.deadline) : t("Выбрать дату…")}
        </DateInput>
      </div>
      <label className="flex min-w-0 items-center gap-2 text-sm">
        {t("Секция")}
        <select
          aria-label={t("Секция карточки")}
          className="max-w-52 rounded border bg-background p-2"
          value={card.columnId}
          onChange={(e) =>
            moveToSection({ id: cardId, columnId: e.target.value })
          }
        >
          {board?.columns.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </select>
      </label>
      {mode === "manual" && (
        <ProgressField
          key={`${card.id}-${card.progress}`}
          value={card.progress}
          onCommit={(progress) => update({ progress })}
          label={t("Готовность задачи")}
        />
      )}
      {mode === "position" && (
        <span className="text-xs text-muted-foreground">
          {t("Готовность по порядку:")}{" "}
          {positional == null ? "—" : `${positional}%`}
        </span>
      )}
      {layout &&
        axes &&
        (
          [
            ["stageId", t("Этап"), layout.stages],
            ["stateId", t("Состояние"), layout.states],
          ] as const
        ).map(([field, label, options]) => (
          <label
            className="flex min-w-0 items-center gap-2 text-sm"
            key={field}
          >
            {label}
            <select
              aria-label={label}
              value={axes[field]}
              className="max-w-52 rounded border bg-background p-2 text-foreground"
              onChange={(e) => update({ [field]: e.target.value })}
            >
              {options.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
        ))}
    </div>
  )
}
