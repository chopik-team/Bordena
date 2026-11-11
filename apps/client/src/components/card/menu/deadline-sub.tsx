import { useT } from "@bordena/i18n"
import { MenuContent, MenuSub, MenuSubTrigger } from "@bordena/ui-kit"
import { CalendarDays } from "lucide-react"
import { Suspense, lazy } from "react"
import { useUpdateCard, useCard } from "@bordena/core"
const DeadlineCalendar = lazy(() => import("./deadline-calendar"))
export function DeadlineSub({
  cardId,
  closeMenu,
}: {
  cardId: string
  closeMenu: () => void
}) {
  const t = useT()
  const { data: card } = useCard(cardId)
  const { mutate: updateCard } = useUpdateCard(cardId)
  return (
    <MenuSub>
      <MenuSubTrigger>
        <CalendarDays />
        {t("Срок")}
      </MenuSubTrigger>
      <MenuContent align="start" sideOffset={2}>
        <Suspense fallback={null}>
          <DeadlineCalendar
            value={card?.deadline ?? null}
            onSelect={(deadline) => {
              updateCard({ deadline })
              closeMenu()
            }}
          />
        </Suspense>
      </MenuContent>
    </MenuSub>
  )
}
