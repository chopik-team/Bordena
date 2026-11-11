import { useT } from "@bordena/i18n"
import { Toast } from "@bordena/ui-kit"
import { ArrowRightLeft } from "lucide-react"
interface IProps {
  visible: boolean
  title: string
}
/** Shown after moving a card through the menu, where nothing else confirms it. */
export function CardMoveToast({ visible, title }: IProps) {
  const t = useT()
  return (
    <Toast visible={visible}>
      <div
        role="status"
        className="flex items-center gap-2 px-4 py-2.5 text-sm"
      >
        <ArrowRightLeft className="size-4 shrink-0 text-muted-foreground" />
        {t("Moved to")} {title}
      </div>
    </Toast>
  )
}
