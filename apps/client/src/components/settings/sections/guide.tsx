import { useState } from "react"
import { useLocale, useT } from "@bordena/i18n"
import { guideTopics } from "@/lib/guide"
export function GuideSection() {
  const locale = useLocale(),
    t = useT(),
    [query, setQuery] = useState(""),
    [active, setActive] = useState("start")
  const matches = guideTopics.filter((topic) =>
    `${topic[locale].title} ${topic[locale].body}`
      .toLocaleLowerCase(locale)
      .includes(query.trim().toLocaleLowerCase(locale))
  )
  const topic = matches.find((topic) => topic.id === active) ?? matches[0]
  return (
    <section className="space-y-4 p-4">
      <input
        className="w-full rounded-md border bg-background p-2"
        aria-label={t("Поиск по руководству")}
        placeholder={t("Поиск по руководству")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <nav
          aria-label={t("Темы руководства")}
          className="flex max-h-52 flex-col gap-1 overflow-y-auto sm:max-h-[52vh]"
        >
          {matches.map((item) => (
            <button
              key={item.id}
              className="rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent focus-visible:outline-2 aria-current:bg-accent"
              aria-current={item.id === topic?.id ? "page" : undefined}
              onClick={() => setActive(item.id)}
            >
              {item[locale].title}
            </button>
          ))}
        </nav>
        <article>
          {topic ? (
            <>
              <h3 className="mb-3 text-base font-semibold">
                {topic[locale].title}
              </h3>
              <p className="text-sm leading-7 whitespace-pre-line">
                {topic[locale].body}
              </p>
            </>
          ) : (
            <p role="status">{t("Ничего не найдено")}</p>
          )}
        </article>
      </div>
    </section>
  )
}
