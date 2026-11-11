import { useT } from "@bordena/i18n"
import { Button, cn } from "@bordena/ui-kit"
import { LoaderCircle, Paperclip } from "lucide-react"
import { useRef } from "react"
import { useUploads } from "@/providers/attachment-upload/attachment-upload-context"
/**
 * Header control that uploads files to the card via the shared upload context.
 * Disabled with a hint when no sync backend is configured.
 */
export function AddAttachmentButton() {
  const t = useT()
  const { addFiles, busy, enabled, disabledReason } = useUploads()
  const inputRef = useRef<HTMLInputElement>(null)
  async function onFiles(files: FileList | null) {
    await addFiles(files)
    if (inputRef.current) inputRef.current.value = ""
  }
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={disabledReason ?? t("Прикрепить")}
        aria-disabled={!enabled}
        className={cn(!enabled && "opacity-50")}
        disabled={busy}
        onClick={() => {
          if (enabled) inputRef.current?.click()
        }}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Paperclip />}
      </Button>
    </>
  )
}
