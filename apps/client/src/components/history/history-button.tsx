import { useT } from "@bordena/i18n"
import { Button } from "@bordena/ui-kit"
import { History } from "lucide-react"
import { useState } from "react"
import { HistoryFeedModal } from "./history-feed-modal"
export function HistoryButton() {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start gap-2 px-2"
        onClick={() => setOpen(true)}
      >
        <History className="size-4" />
        <span>{t("История")}</span>
      </Button>
      <HistoryFeedModal open={open} onOpenChange={setOpen} />
    </>
  )
}
