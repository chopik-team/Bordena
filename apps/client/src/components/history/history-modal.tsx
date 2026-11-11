import { useT } from "@bordena/i18n"
import { CardContent, Modal, ModalContent, ModalHeader } from "@bordena/ui-kit"
import { useHistory, type HistoryEntry } from "@bordena/core"
import { HistoryList } from "./history-list"

const TITLES: Record<HistoryEntry["entityType"], string> = {
  card: "Card history",
  column: "Column history",
  board: "Board history",
}

interface IProps {
  entityType: HistoryEntry["entityType"]
  entityId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
}

export function HistoryModal({
  entityType,
  entityId,
  open,
  onOpenChange,
  title,
}: IProps) {
  const t = useT()

  const { data: entries } = useHistory(entityType, entityId, open)

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        padding="none"
        showCloseButton={false}
        className="md:max-w-lg"
      >
        <ModalHeader onClose={() => onOpenChange(false)}>
          {title ?? t(TITLES[entityType])}
        </ModalHeader>
        <CardContent className="max-h-[60vh] overflow-y-auto py-4">
          {entries && <HistoryList entries={entries} />}
        </CardContent>
      </ModalContent>
    </Modal>
  )
}
