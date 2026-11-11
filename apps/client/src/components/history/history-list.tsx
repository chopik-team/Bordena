import { useT } from "@bordena/i18n"
import type { HistoryEntry } from "@bordena/core"
import { HistoryRow } from "./history-row"
interface IProps {
  entries: HistoryEntry[]
}
export function HistoryList({ entries }: IProps) {
  const t = useT()
  if (entries.length === 0)
    return (
      <p className="text-sm text-muted-foreground">{t("История пока пуста")}</p>
    )
  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground">
        {t("За последние 14 дней")}{" "}
      </p>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </>
  )
}
