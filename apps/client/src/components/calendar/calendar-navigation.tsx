import { useLocation } from "wouter"
import { useT } from "@bordena/i18n"
import { CalendarDays } from "lucide-react"
import { Button } from "@bordena/ui-kit"
export function CalendarNavigation({
  part = "primary",
}: {
  part?: "all" | "primary" | "list"
}) {
  const t = useT(),
    [path, navigate] = useLocation()
  if (part === "list") return null
  return (
    <section
      className="bordena-calendar-navigation px-2"
      aria-label={t("Календарь")}
    >
      <Button
        variant="ghost"
        aria-current={path.startsWith("/calendar") ? "page" : undefined}
        data-active={path.startsWith("/calendar") || undefined}
        className="w-full justify-start"
        onClick={() => navigate("~/calendar")}
      >
        <CalendarDays />
        {t("Календарь")}
      </Button>
    </section>
  )
}
