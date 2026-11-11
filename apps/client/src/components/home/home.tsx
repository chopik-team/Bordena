import { useT } from "@bordena/i18n"
import { ArrowRight, Plus } from "lucide-react"
import logo from "../../assets/bordena-logo.png"
import { Button } from "@bordena/ui-kit"
import type { Dashboard } from "@bordena/core"
import { PageHeader } from "../app/page-header"
interface IProps {
  hasBoards: boolean
  /** The board open most recently, offered as a "continue editing" shortcut. */
  lastBoard: Dashboard | null
  onContinue: () => void
  onCreateDashboard: () => void
}
export function Home({
  hasBoards,
  lastBoard,
  onContinue,
  onCreateDashboard,
}: IProps) {
  const t = useT()
  return (
    <div className="flex h-full flex-1 flex-col">
      <PageHeader className="min-h-14" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <img src={logo} alt="Bordena" className="size-20 object-contain" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {hasBoards ? t("Выберите доску для работы") : t("Пока нет досок")}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasBoards
              ? t("Откройте доску в боковой панели или создайте новую.")
              : t(
                  "Создайте доску, чтобы упорядочить работу с помощью колонок и карточек."
                )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {lastBoard && (
            <Button variant="secondary" onClick={onContinue}>
              {t("Продолжить:")} {lastBoard.title || t("Новая доска")}
              <ArrowRight className="size-4" />
            </Button>
          )}
          <Button onClick={onCreateDashboard}>
            <Plus className="size-4" />
            {t("Создать доску")}{" "}
          </Button>
        </div>
      </div>
    </div>
  )
}
