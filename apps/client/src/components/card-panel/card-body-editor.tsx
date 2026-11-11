import { useT } from "@bordena/i18n"
import { DEFAULT_SLASH_COMMANDS, toAttachmentSrc, cut } from "@bordena/markdown"
import { useMemo, useState } from "react"
import {
  useCardRefOptions,
  useCard,
  useTagOptions,
  useMembersOptions,
} from "@bordena/core"
import { useDeck } from "@/providers/deck/deck-context"
import { imageSlashCommands } from "../card/attachments/image-slash-commands"
import { isRenderableImage } from "../card/attachments/renderable-image"
import { useUploads } from "@/providers/attachment-upload/attachment-upload-context"
import { CardMarkdown } from "../card/card-markdown"
import { cn, Markdown } from "@bordena/ui-kit"
import { MarkdownEditor } from "@bordena/editor"
import type { TextSelectionAction } from "@bordena/editor"
import { SelectionLinksDialog } from "./selection-links-dialog"
const PREVIEW_MARKERS = [cut]
interface IProps {
  cardId: string
  body: string
  autoFocus?: boolean
  isPreview: boolean
  onChangeBody: (value: string) => void
  /** Non-scrolling pane element the mobile slash button anchors to. */
  overlayContainer?: HTMLElement | null
}
/** Card body textarea wired to attachments. Must render inside `AttachmentUploadProvider`. */
export function CardBodyEditor({
  cardId,
  body,
  autoFocus,
  isPreview,
  onChangeBody,
  overlayContainer,
}: IProps) {
  const t = useT()
  const [selection, setSelection] = useState<TextSelectionAction | null>(null)
  const { id: deckId } = useDeck()
  const { data: card } = useCard(cardId)
  const { addFiles } = useUploads()
  const cardRefs = useCardRefOptions(deckId, cardId)
  const tags = useTagOptions(deckId)
  const members = useMembersOptions(deckId)
  const attachments = card?.attachments
  const slashCommands = useMemo(
    () => [
      ...DEFAULT_SLASH_COMMANDS.map((command) => ({
        ...command,
        title: t(command.title),
        hint: command.hint ? t(command.hint) : undefined,
      })),
      ...imageSlashCommands(attachments ?? []),
    ],
    [attachments, t]
  )
  const suggestions = useMemo(
    () => ({ "#": tags, "@": members }),
    [tags, members]
  )
  async function handlePasteFiles(files: File[]): Promise<string | null> {
    const added = await addFiles(files)
    const refs = added
      .filter((a) => isRenderableImage(a.mime))
      .map((a) => `![${a.name}](${toAttachmentSrc(a.key)})`)
    return refs.length ? refs.join("\n") : null
  }
  return (
    <CardMarkdown cardId={cardId} body={body} onChangeBody={onChangeBody}>
      <MarkdownEditor
        onSelectionMenu={setSelection}
        renderPreview={Markdown}
        value={body}
        autoFocus={autoFocus}
        onChangeValue={onChangeBody}
        onToggleTask={onChangeBody}
        slashMenu
        markdown
        slashCommands={slashCommands}
        overlayContainer={overlayContainer}
        wikilinks={cardRefs}
        suggestions={suggestions}
        onPasteFiles={handlePasteFiles}
        placeholder={t("Заметки")}
        isPreview={isPreview}
        markers={PREVIEW_MARKERS}
        className={cn(
          "min-h-[50vh] shrink-0 text-foreground/90",
          isPreview && "text-[1.1rem]"
        )}
        containerClassName="flex-1"
      />
      {selection && (
        <SelectionLinksDialog
          selection={selection}
          cardId={cardId}
          onClose={() => setSelection(null)}
        />
      )}
    </CardMarkdown>
  )
}
