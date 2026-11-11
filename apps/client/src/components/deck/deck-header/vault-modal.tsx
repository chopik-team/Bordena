import { useT } from "@bordena/i18n"
import {
  Button,
  CardContent,
  Modal,
  ModalContent,
  ModalHeader,
  cn,
} from "@bordena/ui-kit"
import { FolderOpen } from "lucide-react"
interface IProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  path: string | null
  error: string | null
  mount: () => Promise<void>
  unmount: () => void
}
/**
 * The folder a board mirrors to, and the controls to pick it or stop.
 */
export function VaultModal({
  open,
  onOpenChange,
  path,
  error,
  mount,
  unmount,
}: IProps) {
  const t = useT()
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        padding="none"
        showCloseButton={false}
        className="md:max-w-lg"
      >
        <ModalHeader onClose={() => onOpenChange(false)}>
          {t("Связь с папкой")}{" "}
        </ModalHeader>
        <CardContent className="space-y-3 overflow-y-auto py-4">
          <div className="flex items-start gap-3">
            <FolderOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {t("Связать эту доску с папкой")}
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Папка для каждой колонки, Markdown-файл для каждой карточки. Изменения передаются в обе стороны. Удалённые карточки попадают в"
                )}{" "}
                <code>_trash</code>.
              </p>
            </div>
            {path ? (
              <Button variant="secondary" size="sm" onClick={unmount}>
                {t("Отключить")}{" "}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void mount()}
              >
                {t("Выбрать папку")}{" "}
              </Button>
            )}
          </div>

          {path && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={path}
                aria-label={t("Связанная папка")}
                onFocus={(e) => e.currentTarget.select()}
                className={cn(
                  "min-w-0 flex-1 rounded-md border bg-muted/40 px-2 py-1.5",
                  "font-mono text-xs text-muted-foreground outline-none"
                )}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void mount()}
              >
                {t("Изменить")}{" "}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </ModalContent>
    </Modal>
  )
}
