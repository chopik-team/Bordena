import { useT } from "@bordena/i18n"
import { useState } from "react"
import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bordena/ui-kit"
import { Folder, FolderSync } from "lucide-react"
import { useVault } from "@/lib/vault/use-vault"
import { VaultModal } from "./vault-modal"

interface IProps {
  boardId: string
  dialogOnly?: boolean
  onClose?: () => void
}

/**
 * Opens the folder sync settings. The files are left behind when the sync
 * stops: unmounting stops the sync, it doesn't undo it.
 */
export function VaultButton({ boardId, dialogOnly = false, onClose }: IProps) {
  const t = useT()
  const [open, setOpen] = useState(dialogOnly)
  const { available, path, error, mount, unmount } = useVault(boardId)
  if (!available) return null

  const label = path
    ? t("Синхронизация с {path}", { path })
    : t("Связать эту доску с папкой")

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      className={cn(
        error && "text-destructive",
        !error && path ? "text-foreground" : "text-muted-foreground"
      )}
      onClick={() => setOpen(true)}
    >
      {path ? <FolderSync /> : <Folder />}
    </Button>
  )

  return (
    <>
      {!dialogOnly && (
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipContent>{error ?? label}</TooltipContent>
        </Tooltip>
      )}
      <VaultModal
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) onClose?.()
        }}
        path={path}
        error={error}
        mount={mount}
        unmount={unmount}
      />
    </>
  )
}
