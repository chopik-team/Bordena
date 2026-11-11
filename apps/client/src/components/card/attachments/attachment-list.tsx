import { useT } from "@bordena/i18n"
import {
  CardContent,
  cn,
  Button,
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@bordena/ui-kit"
import { MoreHorizontal, Pin } from "lucide-react"
import { useState } from "react"
import { Loader2, Paperclip, X } from "lucide-react"
import type { Attachment } from "@bordena/core"
interface IProps {
  attachments: Attachment[]
  onOpen: (attachment: Attachment) => void
  /** Omit to drop the remove button. */
  onRemove?: (attachment: Attachment) => void
  onChange?: (attachment: Attachment, patch: Partial<Attachment>) => void
  onMove?: (attachment: Attachment, direction: -1 | 1) => void
  onDeleteCopy?: (attachment: Attachment) => void
  /** Uploads still in flight, shown greyed at the end. */
  pending?: {
    id: string
    name: string
  }[]
  error?: string
  className?: string
}
const NO_PENDING: {
  id: string
  name: string
}[] = []
/** A card's attachments, one clipped name per row. */
export function AttachmentList({
  attachments,
  onOpen,
  onRemove,
  onChange,
  onMove,
  onDeleteCopy,
  pending = NO_PENDING,
  error,
  className,
}: IProps) {
  const t = useT()
  const [editing, setEditing] = useState<string | null>(null)
  if (!attachments.length && !pending.length) return null
  return (
    <CardContent className={cn("border-t-0", className)}>
      <div className="flex flex-col items-start">
        {attachments.map((att) => (
          <div
            key={att.id}
            data-slot="attachment"
            className="group/item flex w-full min-w-0 flex-wrap items-center gap-1 rounded-md py-1"
          >
            <button
              type="button"
              title={att.name}
              className="flex min-w-0 flex-1 cursor-pointer items-center py-1 text-left text-muted-foreground focus-visible:outline-2"
              onClick={(e) => {
                onOpen(att)
                e.stopPropagation()
              }}
            >
              <Paperclip className="size-3.5 shrink-0" />
              <span className="line-clamp-1 px-1 text-sm group-hover/item:text-foreground">
                {att.pinned && <Pin className="mr-1 inline size-3" />}
                {att.group ? `${att.group} · ` : ""}
                {att.name}
              </span>
            </button>
            {onChange && (
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("Действия с вложением")}
                    />
                  }
                >
                  <MoreHorizontal />
                </MenuTrigger>
                <MenuContent>
                  <MenuItem
                    onClick={() =>
                      setEditing(editing === att.id ? null : att.id)
                    }
                  >
                    {t("Переименовать / группа")}
                  </MenuItem>
                  <MenuItem
                    onClick={() => onChange(att, { pinned: !att.pinned })}
                  >
                    {t(att.pinned ? "Открепить" : "Закрепить")}
                  </MenuItem>
                  {onMove && (
                    <>
                      <MenuItem onClick={() => onMove(att, -1)}>
                        {t("Выше")}
                      </MenuItem>
                      <MenuItem onClick={() => onMove(att, 1)}>
                        {t("Ниже")}
                      </MenuItem>
                    </>
                  )}
                  {onDeleteCopy && (
                    <MenuItem
                      variant="destructive"
                      onClick={() => onDeleteCopy(att)}
                    >
                      {t("Удалить копию")}
                    </MenuItem>
                  )}
                </MenuContent>
              </Menu>
            )}
            {editing === att.id && onChange && (
              <div className="space-y-1 p-2">
                <input
                  aria-label={t("Имя вложения")}
                  defaultValue={att.name}
                  className="w-full rounded border bg-background p-1"
                  onBlur={(e) => {
                    if (e.target.value.trim())
                      onChange(att, { name: e.target.value.trim() })
                  }}
                />
                <input
                  aria-label={t("Группа вложения")}
                  defaultValue={att.group ?? ""}
                  placeholder={t("Группа вложения")}
                  className="w-full rounded border bg-background p-1"
                  onBlur={(e) => onChange(att, { group: e.target.value })}
                />
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                aria-label={t("Убрать вложение")}
                onClick={() => onRemove(att)}
                className={cn(
                  "mt-0.5 ml-2 shrink-0 rounded p-1 text-muted-foreground",
                  "hover:text-destructive"
                )}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        {pending.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1 rounded-md py-0.5 opacity-60"
          >
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="truncate px-2 text-sm text-muted-foreground">
              {p.name}
            </span>
          </div>
        ))}
      </div>
      {error && <div className="mt-1 text-sm text-destructive">{error}</div>}
    </CardContent>
  )
}
