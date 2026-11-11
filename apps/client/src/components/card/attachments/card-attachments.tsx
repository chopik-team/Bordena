import { useState } from "react"
import {
  type Attachment,
  useCard,
  useUpdateCard,
  activeStorage,
  attachmentUnavailable,
  useConnection,
} from "@bordena/core"
import { downloadBlob, revealInDownloads } from "@/lib/download"
import { isDesktop } from "@/lib/platform"
import {
  useAttachmentUrls,
  invalidateAttachmentUrl,
} from "@/lib/hooks/use-attachment-url"
import { AttachmentList } from "./attachment-list"
import { AttachmentViewer } from "./attachment-viewer"
import { isRenderableImage } from "./renderable-image"
import { usePendingUploads } from "@/providers/attachment-upload/attachment-upload-context"
import { ExternalMaterials } from "./external-materials"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { deleteManagedAttachment } from "@/lib/exchange/workspace"
import { useT } from "@bordena/i18n"
import { keys, queryClient, reportError } from "@bordena/core"

interface IProps {
  cardId: string
  isReadonly: boolean
  className: string
}

const NO_ATTACHMENTS: Attachment[] = []

/** A card's attachments, backed by the storage adapter. */
export function CardAttachments({ cardId, isReadonly, className }: IProps) {
  const t = useT(),
    [deleting, setDeleting] = useState<Attachment | null>(null)
  const { data: card } = useCard(cardId)
  const { mutateAsync: save } = useUpdateCard(cardId)

  const connection = useConnection()
  const [error, setError] = useState("")
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const pending = usePendingUploads()

  const attachments = card?.attachments ?? NO_ATTACHMENTS
  const sorted = [...attachments].sort(
    (a, b) => Number(!!b.pinned) - Number(!!a.pinned)
  )
  const urls = useAttachmentUrls(cardId, viewing ? [viewing] : NO_ATTACHMENTS)

  const persist = (next: Attachment[]) => save({ attachments: next })

  async function remove(att: Attachment) {
    try {
      await persist(attachments.filter((a) => a.id !== att.id))
    } catch {
      setError(attachmentUnavailable(connection))
    }
  }

  async function open(att: Attachment) {
    setError("")
    try {
      const storage = activeStorage()
      if (isRenderableImage(att.mime) || att.mime.startsWith("audio/")) {
        setViewing(att)
        return
      }
      if (isDesktop()) {
        const blob = await storage.get(cardId, att.key)
        await revealInDownloads(
          att.name,
          new Uint8Array(await blob.arrayBuffer())
        )
        return
      }
      if (isRenderableImage(att.mime)) {
        setViewing(att)
        return
      }
      await downloadBlob(await storage.get(cardId, att.key), att.name)
    } catch {
      setError(attachmentUnavailable(connection))
    }
  }

  return (
    <>
      <AttachmentList
        attachments={sorted}
        pending={pending}
        error={error}
        className={className}
        onOpen={(att) => void open(att)}
        onRemove={isReadonly ? undefined : (att) => void remove(att)}
        onChange={
          isReadonly
            ? undefined
            : (att, patch) =>
                void persist(
                  attachments.map((a) =>
                    a.id === att.id ? { ...a, ...patch } : a
                  )
                ).catch(() => setError(attachmentUnavailable(connection)))
        }
        onMove={
          isReadonly
            ? undefined
            : (att, direction) => {
                const index = attachments.findIndex((a) => a.id === att.id),
                  target = index + direction
                if (target < 0 || target >= attachments.length) return
                const next = [...attachments]
                ;[next[index], next[target]] = [next[target], next[index]]
                void persist(next).catch(() =>
                  setError(attachmentUnavailable(connection))
                )
              }
        }
        onDeleteCopy={isReadonly ? undefined : setDeleting}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("Удалить управляемую копию?")}
        description={t(
          "Копия будет удалена из профиля Bordena. Перед удалением создаётся проверенная резервная копия. Ссылки на это вложение в Markdown станут недоступны."
        )}
        confirmLabel={t("Удалить копию")}
        onConfirm={() => {
          if (!deleting) return
          void deleteManagedAttachment(cardId, deleting.id)
            .then(async () => {
              invalidateAttachmentUrl(cardId, deleting.key)
              setDeleting(null)
              await queryClient.invalidateQueries({
                queryKey: keys.card(cardId),
              })
              await queryClient.invalidateQueries({ queryKey: keys.boards })
            })
            .catch(reportError)
        }}
      />
      <ExternalMaterials cardId={cardId} readonly={isReadonly} />
      <AttachmentViewer
        attachment={viewing}
        src={viewing ? (urls[viewing.key] ?? null) : null}
        onClose={() => setViewing(null)}
        onDownload={async () => {
          if (!viewing) return
          const blob = await activeStorage().get(cardId, viewing.key)
          await downloadBlob(blob, viewing.name)
        }}
      />
    </>
  )
}
