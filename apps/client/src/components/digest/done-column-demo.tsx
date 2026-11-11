import { useT } from "@bordena/i18n"
import { cn } from "@bordena/ui-kit"
import { Check, CircleCheck } from "lucide-react"
import { useEffect, useState } from "react"
/** How long the card rests in a column before sliding to the other one. */
const BEAT_MS = 1800
function MiniColumn({ title, done }: { title: string; done?: boolean }) {
  return (
    <div>
      <div className="flex h-5 items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            done ? "bg-emerald-500/60" : "bg-muted-foreground/30"
          )}
        />
        <span className="truncate">{title}</span>
        {done && (
          <CircleCheck className="size-3 shrink-0 text-emerald-600/60 dark:text-emerald-500/60" />
        )}
      </div>
      <div className="mt-2 h-9 rounded-md border border-dashed border-border" />
    </div>
  )
}
/** A card ticking itself back and forth between a board's two columns. */
export function DoneColumnDemo() {
  const t = useT()
  const [done, setDone] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setDone((v) => !v), BEAT_MS)
    return () => clearInterval(id)
  }, [])
  return (
    <div
      aria-hidden
      className="relative rounded-lg border bg-muted/30 p-3 select-none"
    >
      <div className="grid grid-cols-2 gap-3">
        <MiniColumn title={t("В работе")} />
        <MiniColumn title={t("Готово")} done />
      </div>
      <div
        className={cn(
          "absolute top-10 left-3 w-[calc(50%-1.125rem)]",
          "transition-transform duration-500 ease-out motion-reduce:transition-none"
        )}
        style={{ transform: done ? "translateX(calc(100% + 0.75rem))" : "" }}
      >
        <div className="flex h-9 items-center gap-2 rounded-md border bg-card px-2 shadow-e1">
          <span
            className={cn(
              "flex size-3.5 shrink-0 items-center justify-center rounded-[3px]",
              "border border-input text-primary-foreground transition-colors",
              done && "border-primary bg-primary"
            )}
          >
            {done && <Check className="size-2.5" strokeWidth={3} />}
          </span>
          <span
            className={cn(
              "truncate text-[11px] transition-opacity",
              done && "text-muted-foreground line-through opacity-60"
            )}
          >
            {t("Полить растения")}{" "}
          </span>
        </div>
      </div>
    </div>
  )
}
