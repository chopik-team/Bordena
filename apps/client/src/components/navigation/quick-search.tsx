import { useT } from "@bordena/i18n"
import { useEffect, useMemo, useState, Fragment } from "react"
import { useQuery } from "@tanstack/react-query"
import { db, keys, searchCards, useDashboards } from "@bordena/core"
import { Modal, ModalContent, ModalTitle } from "@bordena/ui-kit"
import { useLocation } from "wouter"
import { useOrganization } from "@/lib/hooks/use-organization"
import { appCommands } from "@/lib/app-commands"
import { openAppSettings } from "@/lib/app-settings"
import { useUiFlag } from "@/lib/ui-state"
import { usePreferences } from "@/lib/preferences"
import { useCalendarState, selectCalendar } from "@/lib/calendar-data"
import { workspaceList } from "@/lib/workspaces"
import {
  Command,
  PanelsTopLeft,
  CalendarDays,
  FileText,
  Folder,
  Layers,
} from "lucide-react"
import { setPreferences } from "@/lib/preferences"
import { setFolderCollapsed } from "@bordena/core"
import { changeNavigation } from "@/lib/navigation"
interface QuickHit {
  id: string
  title: string
  detail: string
  url?: string
  action?: () => void
  kind?: "command" | "calendar" | "board" | "card" | "workspace" | "project"
  folderId?: string
  workspaceId?: string
  archived?: boolean
}
export function QuickSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const t = useT()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const { data: boards = [] } = useDashboards()
  const { data: organization } = useOrganization()
  const [path, navigate] = useLocation()
  const { data: calendar } = useCalendarState()
  const preferences = usePreferences()
  const [focus, setFocus] = useUiFlag("focus")
  const { data } = useQuery({
    queryKey: [...keys.boards, "quick-search"],
    queryFn: async () => ({
      cards: await db.getCards(),
      columns: await db.getColumns(),
    }),
    enabled: open,
    staleTime: 0,
    networkMode: "always",
  })
  const entityHits = useMemo<QuickHit[]>(() => {
    if (!query.trim()) return []
    const liveBoards = new Map(boards.map((b) => [b.id, b]))
    const columns = (data?.columns ?? []).filter(
      (c) => !c.deletedAt && liveBoards.has(c.dashboardId)
    )
    const columnMap = new Map(columns.map((c) => [c.id, c]))
    const boardHits = boards
      .filter((b) =>
        b.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      )
      .map((b) => ({
        id: "board:" + b.id,
        kind: "board" as const,
        title: b.title,
        detail: t("Доска"),
        url: `~/d/${b.id}`,
      }))
    const cardHits = searchCards({
      cards: (data?.cards ?? []).filter(
        (c) => !c.deletedAt && columnMap.has(c.columnId)
      ),
      columns,
      query,
    }).map((hit) => {
      const col = columnMap.get(hit.card.columnId)!
      return {
        id: "card:" + hit.card.id,
        kind: "card" as const,
        title: hit.card.title || t("Без названия"),
        detail: liveBoards.get(col.dashboardId)!.title,
        url: `~/d/${col.dashboardId}/c/${hit.card.id}`,
      }
    })
    const projectHits = (organization?.sidebar.items ?? [])
      .filter(
        (item) =>
          item.type === "folder" &&
          item.title
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase())
      )
      .map((item) => ({
        id: "project:" + item.id,
        kind: "project" as const,
        title: item.type === "folder" ? item.title : "",
        detail: t("Проект или папка"),
        url: "~/",
        folderId: item.id,
        workspaceId:
          item.type === "folder" ? (item.workspaceId ?? "default") : "default",
        archived: item.type === "folder" ? item.archived : false,
      }))
    const calHits = (calendar?.calendars ?? [])
      .filter(
        (c) =>
          !c.deletedAt &&
          c.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      )
      .map((c) => ({
        id: "calendar:" + c.id,
        title: c.title,
        detail: t("Календарь"),
        kind: "calendar" as const,
        action: () => {
          selectCalendar(c.id)
          navigate("~/calendar")
        },
      }))
    const spaces = workspaceList(organization?.sidebar)
      .filter((w) =>
        w.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      )
      .map((w) => ({
        id: "workspace:" + w.id,
        kind: "workspace" as const,
        title: w.title,
        detail: t("Рабочее пространство"),
        workspaceId: w.id,
        folderId: "",
        url: "~/",
        action: () => {
          setPreferences({ workspaceId: w.id, showArchived: !!w.archived })
          changeNavigation((s) => ({ ...s, active: null }))
          navigate("~/")
        },
      }))
    return [
      ...spaces,
      ...calHits,
      ...projectHits,
      ...boardHits,
      ...cardHits,
    ].slice(0, 100)
  }, [query, boards, data, organization, t, calendar, navigate])
  const commands: QuickHit[] = appCommands
    .filter(
      (c) =>
        (!("view" in c) || path.startsWith("/d/")) &&
        (!("onlyBoard" in c) || path.startsWith("/d/")) &&
        t(c.title)
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())
    )
    .map((c) => ({
      id: "command:" + c.id,
      title: t(c.title),
      detail: t("Команды"),
      kind: "command",
      action: () => {
        if ("view" in c)
          window.dispatchEvent(
            new CustomEvent("bordena:view", { detail: c.view })
          )
        else if ("mode" in c) {
          if (c.mode === "focus") setFocus(!focus)
          else
            setPreferences({
              density: preferences.density === "compact" ? "normal" : "compact",
            })
        } else if ("section" in c) openAppSettings(c.section)
        else if ("calendar" in c && path.startsWith("/calendar"))
          window.dispatchEvent(new Event(c.event))
        else if ("route" in c) navigate(c.route)
        else if ("event" in c) window.dispatchEvent(new Event(c.event))
      },
    }))
  const hits = [...commands, ...entityHits].slice(0, 100)
  useEffect(() => {
    if (open)
      document
        .getElementById(`quick-${active}`)
        ?.scrollIntoView({ block: "nearest" })
  }, [active, open, query])
  const select = (index: number) => {
    if (hits[index]) {
      const hit = hits[index]
      if (hit.folderId) {
        setPreferences({
          workspaceId: hit.workspaceId ?? "default",
          ...(hit.archived ? { showArchived: true } : {}),
        })
        setFolderCollapsed(hit.folderId, false)
        changeNavigation((s) => ({ ...s, active: null }))
      }
      if (hit.action) hit.action()
      else if (hit.url) navigate(hit.url)
      onOpenChange(false)
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) {
          setQuery("")
          setActive(0)
        }
      }}
    >
      <ModalContent className="md:max-w-xl">
        <ModalTitle>{t("Поиск и команды")}</ModalTitle>
        <input
          autoFocus
          aria-label={t("Поиск досок и карточек")}
          placeholder={t("Найти объект или выполнить команду")}
          value={query}
          className="mt-3 w-full rounded-md border bg-background p-2 focus-visible:outline-2"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="quick-results"
          aria-activedescendant={hits[active] ? `quick-${active}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              select(active)
            }
            if (hits.length && ["ArrowDown", "ArrowUp"].includes(e.key)) {
              e.preventDefault()
              setActive(
                (i) =>
                  (i + (e.key === "ArrowDown" ? 1 : -1) + hits.length) %
                  hits.length
              )
            }
          }}
        />
        <div
          id="quick-results"
          role="listbox"
          aria-label={t("Результаты поиска")}
          className="mt-2 max-h-80 overflow-y-auto"
        >
          {hits.map((hit, i) => (
            <Fragment key={hit.id}>
              {(i === 0 || hits[i - 1].kind !== hit.kind) && (
                <p
                  role="presentation"
                  className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground"
                >
                  {t(
                    hit.kind === "command"
                      ? "Команды"
                      : hit.kind === "calendar"
                        ? "Календари"
                        : hit.kind === "workspace"
                          ? "Рабочее пространство"
                          : hit.kind === "project"
                            ? "Проект или папка"
                            : hit.kind === "card"
                              ? "Карточки"
                              : "Доски"
                  )}
                </p>
              )}
              <button
                role="option"
                aria-selected={active === i}
                id={`quick-${i}`}
                key={hit.id}
                title={hit.title}
                className="flex w-full min-w-0 flex-col rounded-md p-2 text-left text-sm [overflow-wrap:anywhere] break-words focus-visible:outline-2 aria-selected:bg-accent"
                onClick={() => select(i)}
              >
                <span className="flex min-w-0 items-center gap-2 [&>svg]:shrink-0">
                  {hit.kind === "command" ? (
                    <Command className="size-4" />
                  ) : hit.kind === "calendar" ? (
                    <CalendarDays className="size-4" />
                  ) : hit.kind === "card" ? (
                    <FileText className="size-4" />
                  ) : hit.kind === "workspace" ? (
                    <Layers className="size-4" />
                  ) : hit.kind === "project" ? (
                    <Folder className="size-4" />
                  ) : (
                    <PanelsTopLeft className="size-4" />
                  )}
                  {hit.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {hit.detail}
                </span>
              </button>
            </Fragment>
          ))}
          {!hits.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {query
                ? t("Ничего не найдено")
                : t("Локальный поиск по всем доскам и карточкам")}
            </p>
          )}
        </div>
      </ModalContent>
    </Modal>
  )
}
