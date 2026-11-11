import { useT } from "@bordena/i18n"
import { Button, cn } from "@bordena/ui-kit"
import { Plus } from "lucide-react"
interface IProps {
  onAdd: () => void
}
/** The trailing "+", standing where the next column would go. */
export function AddColumn({ onAdd }: IProps) {
  const t = useT()
  return (
    <div className="flex w-full shrink-0 snap-center flex-col pb-6 xs:w-sm">
      {/* Clears the column headers, so the button starts level with the card lists. */}
      <div className="h-15 shrink-0" />
      <Button
        variant="ghost"
        onClick={onAdd}
        aria-label={t("Добавить колонку")}
        className={cn(
          "min-h-20 w-full shrink-0 rounded-2xl bg-background p-4 transition-colors",
          "border border-sidebar-primary-foreground",
          "shadow-inset"
        )}
      >
        <div className="flex items-center gap-2 text-muted-foreground/50 uppercase">
          <Plus />
          {t("Добавить колонку")}{" "}
        </div>
      </Button>
    </div>
  )
}
