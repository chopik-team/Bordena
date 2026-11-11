import { useT } from "@bordena/i18n"
import {
  Droppable,
  type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd"
import { useState, type ReactNode } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { ColumnMenu } from "./column-menu"
import { ColumnView } from "./column-view"
interface IProps {
  children: ReactNode
  id: string
  title: string
  color: string
  showBody: boolean
  onToggleBody: () => void
  onAddCard?: () => void
  addCardDisabledReason?: string
  onRename: (title: string) => void
  onChangeColor: (color: string) => void
  /** Cards in this column count as finished. */
  done: boolean
  onChangeDone: (done: boolean) => void
  onDelete: () => void
  sectionCollapsed?: boolean
  tint?: boolean
  leading?: ReactNode
  menuExtra?: ReactNode
  onToggleSection?: () => void
  autoRename?: boolean
  headerDragProps?: DraggableProvidedDragHandleProps | null
}
export function Column({
  children,
  id,
  title,
  color,
  showBody,
  onToggleBody,
  onAddCard,
  addCardDisabledReason,
  onRename,
  onChangeColor,
  done,
  onChangeDone,
  onDelete,
  sectionCollapsed,
  tint,
  leading,
  menuExtra,
  onToggleSection,
  autoRename,
  headerDragProps,
}: IProps) {
  const t = useT()
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <Droppable droppableId={id} isDropDisabled={sectionCollapsed}>
      {(provided, snapshot) => (
        <ColumnMenu
          title={title}
          color={color}
          onChangeColor={onChangeColor}
          done={done}
          onChangeDone={onChangeDone}
          onDelete={() => setConfirmOpen(true)}
          extra={menuExtra}
          showBody={showBody}
          onToggleBody={onToggleBody}
        >
          <ColumnView
            title={title}
            sectionCollapsed={sectionCollapsed}
            tint={tint}
            leading={leading}
            onToggleSection={onToggleSection}
            autoRename={autoRename}
            headerDragProps={headerDragProps}
            onChangeColor={onChangeColor}
            color={color}
            done={done}
            showBody={showBody}
            onToggleBody={onToggleBody}
            onRename={onRename}
            onAddCard={onAddCard}
            addCardDisabledReason={addCardDisabledReason}
            isDraggingOver={snapshot.isDraggingOver}
            listRef={provided.innerRef}
            listProps={provided.droppableProps}
            menu={
              <>
                <ColumnMenu
                  showBody={showBody}
                  onToggleBody={onToggleSection ? onToggleBody : undefined}
                  extra={menuExtra}
                  title={title}
                  color={color}
                  onChangeColor={onChangeColor}
                  done={done}
                  onChangeDone={onChangeDone}
                  onDelete={() => setConfirmOpen(true)}
                />
                <ConfirmDialog
                  open={confirmOpen}
                  onOpenChange={setConfirmOpen}
                  title={t("Удалить колонку?")}
                  description={t(
                    "Секция «{p0}» и её карточки переместятся в корзину на 14 дней. Это также затронет карточки в матрице.",
                    { p0: title }
                  )}
                  confirmLabel={t("Удалить колонку")}
                  onConfirm={onDelete}
                />
              </>
            }
          >
            {children}
            {provided.placeholder}
          </ColumnView>
        </ColumnMenu>
      )}
    </Droppable>
  )
}
