import { useT } from "@bordena/i18n"
import { CardContent, Modal, ModalContent, ModalHeader } from "@bordena/ui-kit"
import { useActivity } from "@bordena/core"
import { HistoryList } from "./history-list"
interface IProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
export function HistoryFeedModal({ open, onOpenChange }: IProps) {
  const t = useT()
  const { data: entries } = useActivity(open)
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        padding="none"
        showCloseButton={false}
        className="md:max-w-lg"
      >
        <ModalHeader onClose={() => onOpenChange(false)}>
          {t("История")}
        </ModalHeader>
        <CardContent className="max-h-[60vh] overflow-y-auto py-4">
          {entries && <HistoryList entries={entries} />}
        </CardContent>
      </ModalContent>
    </Modal>
  )
}
