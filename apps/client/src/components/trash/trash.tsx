import { useT } from "@bordena/i18n"
import { Trash2, TriangleAlert } from "lucide-react"
import type { TrashEntry } from "@bordena/core"
import { PageHeader } from "../app/page-header"
import { CenteredState } from "../digest/centered-state"
import { TrashRow } from "./trash-row"
interface IProps {
  entries: TrashEntry[]
  isLoading: boolean
  error: Error | null
  restoringId: string | null
  onRestore: (entry: TrashEntry) => void
}
/** Everything deleted across every board, newest first. */
export function Trash({
  entries,
  isLoading,
  error,
  restoringId,
  onRestore,
}: IProps) {
  const t = useT()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader>
        <h1 className="text-base font-semibold">{t("Корзина")}</h1>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-10">
        <div className="mx-auto max-w-lg">
          <Body
            entries={entries}
            isLoading={isLoading}
            error={error}
            restoringId={restoringId}
            onRestore={onRestore}
          />
        </div>
      </div>
    </div>
  )
}
function Body({
  entries,
  isLoading,
  error,
  restoringId,
  onRestore,
}: Pick<
  IProps,
  "entries" | "isLoading" | "error" | "restoringId" | "onRestore"
>) {
  const t = useT()
  if (error)
    return (
      <CenteredState
        icon={<TriangleAlert className="size-8 text-destructive" />}
      >
        <p className="max-w-sm text-sm text-muted-foreground">
          {t(
            "Couldn't read the trash. If the app is open in another tab, close it and reload."
          )}{" "}
        </p>
      </CenteredState>
    )
  if (isLoading) return null
  if (entries.length === 0)
    return (
      <CenteredState icon={<Trash2 className="size-8 text-muted-foreground" />}>
        <p className="text-sm text-muted-foreground">{t("Корзина пуста.")}</p>
      </CenteredState>
    )
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("Элементы здесь удаляются безвозвратно через 14 дней.")}{" "}
      </p>
      <ul aria-label={t("Удалённые элементы")} className="flex flex-col gap-2">
        {entries.map((entry) => (
          <TrashRow
            key={`${entry.kind}/${entry.id}`}
            entry={entry}
            isRestoring={restoringId === entry.id}
            onRestore={() => onRestore(entry)}
          />
        ))}
      </ul>
    </>
  )
}
