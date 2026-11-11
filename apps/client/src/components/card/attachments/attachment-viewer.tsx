import { useT } from "@bordena/i18n"
import { Modal, ModalContent, ModalTitle } from "@bordena/ui-kit"
import { Download, X } from "lucide-react"
import { useState } from "react"
import {
  type Attachment,
  attachmentUnavailable,
  type AttachmentSource,
  useConnection,
} from "@bordena/core"
import { AttachmentUnavailable } from "./attachment-unavailable"
interface IProps {
  attachment: Attachment | null
  /** Resolved by the caller: storage-backed in the app, token-backed on a public board. */
  src: string | null
  source?: AttachmentSource
  onClose: () => void
  onDownload: () => void | Promise<void>
}
/** Full-screen image preview with an explicit close, so a standalone PWA window never navigates away from the board. */
export function AttachmentViewer({
  attachment,
  src,
  source,
  onClose,
  onDownload,
}: IProps) {
  return (
    <Modal open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      {attachment && (
        <ViewerContent
          key={attachment.id}
          attachment={attachment}
          src={src}
          source={source}
          onClose={onClose}
          onDownload={onDownload}
        />
      )}
    </Modal>
  )
}
function ViewerContent({
  attachment,
  src,
  source,
  onClose,
  onDownload,
}: IProps & {
  attachment: Attachment
}) {
  const t = useT()
  const connection = useConnection()
  const [error, setError] = useState("")
  async function download() {
    setError("")
    try {
      await onDownload()
    } catch {
      setError(attachmentUnavailable(connection, source))
    }
  }
  return (
    <ModalContent
      padding="none"
      showCloseButton={false}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="overflow-hidden"
    >
      <div className="flex shrink-0 items-center gap-2 border-b p-3">
        <ModalTitle className="line-clamp-1 flex-1">
          {attachment.name}
        </ModalTitle>
        <button
          type="button"
          aria-label={t("Скачать")}
          onClick={() => void download()}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Download className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t("Закрыть")}
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      {error && (
        <div className="shrink-0 border-b px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex flex-1 items-center justify-center overflow-auto">
        {src ? (
          attachment.mime.startsWith("audio/") ? (
            <div className="space-y-3 p-4">
              <audio
                controls
                src={src}
                onError={() =>
                  setError(t("Формат не поддерживается локальным движком"))
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("Воспроизведение зависит от кодека WebView2.")}
              </p>
            </div>
          ) : (
            <img
              src={src}
              alt={attachment.name}
              className="max-h-full overflow-hidden"
            />
          )
        ) : (
          <AttachmentUnavailable source={source} className="m-4 aspect-video" />
        )}
      </div>
    </ModalContent>
  )
}
