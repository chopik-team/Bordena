import { useT } from "@bordena/i18n"
import {
  Button,
  Modal,
  ModalContent,
  ModalContentCentered,
  ModalDescription,
  ModalTitle,
} from "@bordena/ui-kit"
interface IProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
}
/** A small "are you sure?" modal for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: IProps) {
  const t = useT()
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="md:max-w-sm md:p-6">
        <ModalContentCentered>
          <ModalTitle>{title}</ModalTitle>
          {description && <ModalDescription>{description}</ModalDescription>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("Отмена")}{" "}
            </Button>
            <Button
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {confirmLabel ?? t("Удалить")}
            </Button>
          </div>
        </ModalContentCentered>
      </ModalContent>
    </Modal>
  )
}
