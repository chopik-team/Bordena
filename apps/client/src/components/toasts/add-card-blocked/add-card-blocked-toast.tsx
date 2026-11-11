import { Toast } from "@bordena/ui-kit"
import { Info } from "lucide-react"

interface IProps {
  visible: boolean
  reason: string
}

export function AddCardBlockedToast({ visible, reason }: IProps) {
  return (
    <Toast visible={visible}>
      <div
        role="status"
        className="flex items-center gap-2 px-4 py-2.5 text-sm"
      >
        <Info className="size-4 shrink-0 text-muted-foreground" />
        {reason}
      </div>
    </Toast>
  )
}
