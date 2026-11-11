import { useT } from "@bordena/i18n"
import {
  CardContent,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
} from "@bordena/ui-kit"
import type { Column } from "@bordena/core"
import { ReorderColumnsDNDContainer } from "./reorder-cols-dnd"
interface IProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: Column[]
  onReorder: (changed: Column[]) => void
}
export function ReorderColumnsModal({
  open,
  onOpenChange,
  columns,
  onReorder,
}: IProps) {
  const t = useT()
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        padding="none"
        showCloseButton={false}
        className="md:max-w-md"
      >
        <ModalHeader onClose={() => onOpenChange(false)}>
          {t("Порядок колонок")}{" "}
        </ModalHeader>
        <CardContent className="py-4">
          <div className="flex flex-col gap-4">
            <ModalDescription>
              {t("Перетащите колонку, чтобы изменить порядок на доске.")}{" "}
            </ModalDescription>
            <ReorderColumnsDNDContainer
              columns={columns}
              onReorder={onReorder}
            />
          </div>
        </CardContent>
      </ModalContent>
    </Modal>
  )
}
