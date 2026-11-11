import { useT } from "@bordena/i18n"
import { Button } from "@bordena/ui-kit"
import { useSetColumnDone, useBoard } from "@bordena/core"
import { ColumnSwatch } from "../column/column-swatch"
interface IProps {
  boardId: string
  onPicked: () => void
}
/**
 * Sets the board's done column without leaving the digest.
 */
export function DoneColumnPicker({ boardId, onPicked }: IProps) {
  const t = useT()
  const { data: board } = useBoard(boardId)
  const { mutate: setColumnDone } = useSetColumnDone(boardId)
  const columns = board?.columns ?? []
  if (columns.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {t("В какой колонке находятся выполненные карточки?")}{" "}
      </p>
      <div className="flex flex-wrap gap-2">
        {columns.map((column) => (
          <Button
            key={column.id}
            variant="outline"
            onClick={() => {
              setColumnDone({ id: column.id, done: true })
              onPicked()
            }}
          >
            <ColumnSwatch color={column.color} />
            {column.title || t("Без названия")}
          </Button>
        ))}
      </div>
    </div>
  )
}
