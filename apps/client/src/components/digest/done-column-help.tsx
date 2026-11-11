import { useT } from "@bordena/i18n"
import {
  Button,
  Modal,
  ModalContent,
  ModalContentCentered,
  ModalDescription,
  ModalTitle,
} from "@bordena/ui-kit"
import { DoneColumnDemo } from "./done-column-demo"
import { DoneColumnPicker } from "./done-column-picker"
interface IProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  onOpenBoard: () => void
}
export function DoneColumnHelp({
  open,
  onOpenChange,
  boardId,
  onOpenBoard,
}: IProps) {
  const t = useT()
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="md:max-w-md md:p-6">
        <ModalContentCentered className="gap-4">
          <div className="flex flex-col gap-2">
            <ModalTitle>
              {t("Выберите колонку для выполненных карточек")}
            </ModalTitle>
            <ModalDescription>
              {t(
                "Marking a card done moves it to its board's done column, so a board without one has nowhere to put it."
              )}{" "}
            </ModalDescription>
          </div>

          <DoneColumnDemo />

          <DoneColumnPicker
            boardId={boardId}
            onPicked={() => onOpenChange(false)}
          />

          <p className="text-sm text-muted-foreground">
            {t("Это можно изменить в меню ⋯ колонки.")}{" "}
          </p>

          <div className="mt-1 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={onOpenBoard}>
              {t("Открыть доску")}{" "}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("Позже")}{" "}
            </Button>
          </div>
        </ModalContentCentered>
      </ModalContent>
    </Modal>
  )
}
