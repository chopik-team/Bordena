import { useT } from "@bordena/i18n"
import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "../lib/cn"
export function MdCodeBlock({
  value,
  lang,
}: {
  value: string
  lang?: string | null
}) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy(e: React.MouseEvent) {
    // The block may sit inside a card's open-detail handler.
    e.stopPropagation()
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1000)
  }
  return (
    <div className="group/code relative my-2.5">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 px-3.5 py-3 leading-normal">
        <code
          className={`font-mono text-[0.8125rem] ${lang ? `language-${lang}` : ""}`}
        >
          {value}
        </code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={t("Скопировать код")}
        title={t("Скопировать код")}
        className={cn(
          "absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-1.5 py-1",
          "font-sans text-[0.6875rem] text-muted-foreground hover:text-foreground",
          "transition-opacity focus-visible:opacity-100",
          // Stays visible while confirming, so the copy is not missed.
          copied
            ? "border-primary/60 text-foreground opacity-100"
            : "opacity-0 group-hover/code:opacity-100"
        )}
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {copied && <span aria-live="polite">{t("Скопировано")}</span>}
      </button>
    </div>
  )
}
