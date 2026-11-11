import { useT } from "@bordena/i18n"
import { InvisibleInput } from "@bordena/ui-kit"
interface IProps {
  title: string
  /** Omit where the title cannot be changed. */
  onRename?: (title: string) => void
  autoRename?: boolean
}
/** A column's name, editable in place wherever renaming is possible. */
export function ColumnTitle({ title, onRename, autoRename }: IProps) {
  const t = useT()
  if (!onRename)
    return <span className="line-clamp-1 px-2 uppercase">{title}</span>
  return (
    <InvisibleInput
      autoEdit={autoRename}
      value={title}
      onCommit={onRename}
      label={t("Название секции: {p0}", { p0: title })}
      title={`${title}\n${t("Нажмите для переименования")}`}
    />
  )
}
