import { useT } from "@bordena/i18n"
import { Tooltip, TooltipContent, TooltipTrigger } from "@bordena/ui-kit"
import { TriangleAlert } from "lucide-react"
export function ConflictMarker() {
  const t = useT()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={t("Конфликт изменений")}
            className="inline-flex text-amber-600 dark:text-amber-400"
          />
        }
      >
        <TriangleAlert className="size-4 md:size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{t("Конфликт изменений")}</TooltipContent>
    </Tooltip>
  )
}
