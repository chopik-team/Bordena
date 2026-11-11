import { useT } from "@bordena/i18n"
import { Button, cn, Toast } from "@bordena/ui-kit"
interface IProps {
  visible: boolean
  onRetry: () => void
  onContinueOffline: () => void
}
export function OfflineToastContent({
  visible,
  onRetry,
  onContinueOffline,
}: IProps) {
  const t = useT()
  return (
    <Toast visible={visible}>
      <div
        role="status"
        className={cn(
          "flex w-full max-w-xl items-center gap-3",
          "rounded-lg bg-popover px-4 py-2 text-sm text-popover-foreground"
        )}
      >
        <div>
          <div className="font-medium">{t("Not syncing")}</div>
          <div className="text-muted-foreground">
            {t(
              "Can not connect to server. You might be offline, or unauthenticated. Data is saved on this device."
            )}{" "}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={onRetry}
        >
          {t("Повторить")}{" "}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={onContinueOffline}
        >
          {t("Continue offline")}{" "}
        </Button>
      </div>
    </Toast>
  )
}
