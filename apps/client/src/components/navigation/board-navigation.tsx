import { useT } from "@bordena/i18n"
import { useEffect, useState, useMemo } from "react"
import { useLocation } from "wouter"
import { useDashboards } from "@bordena/core"
import { Button } from "@bordena/ui-kit"
import { Star, X, ChevronUp, Search, ArrowLeft } from "lucide-react"
import { CreateItemMenu } from "./create-item-menu"
import {
  changeNavigation,
  closeBoardTab,
  navigationSnapshot,
  nextBoardTab,
  toggleFavorite,
  useNavigation,
  visitBoard,
} from "@/lib/navigation"
import { useDeck } from "@/providers/deck/deck-context"
import { SidebarSection } from "../sidebar/sidebar-section"
import { QuickSearch } from "./quick-search"
import { usePreferences, setPreferences } from "@/lib/preferences"
let restored = false
export function BoardTabs() {
  const t = useT()
  const { restoreLastBoard, useTabs } = usePreferences()
  const state = useNavigation()
  const { data: actualBoards = [], isPending } = useDashboards()
  const boards = useMemo(
    () => [
      ...actualBoards,
      { id: "calendar", title: t("Календарь"), workspaceId: undefined },
    ],
    [actualBoards, t]
  )
  const { id: deckId } = useDeck()
  const [path] = useLocation()
  const id = path.startsWith("/calendar") ? "calendar" : deckId
  const [, navigate] = useLocation()
  const [search, setSearch] = useState(false)
  const open = (boardId: string | null) =>
    navigate(
      boardId === "calendar" ? "~/calendar" : boardId ? `~/d/${boardId}` : "~/"
    )
  useEffect(() => {
    if (isPending) return
    const ids = new Set(boards.map((b) => b.id))
    changeNavigation((s) => {
      const valid = (xs: string[]) => xs.filter((x) => ids.has(x))
      if (
        [...s.tabs, ...s.favorites, ...s.recent].every((x) => ids.has(x)) &&
        (!s.active || ids.has(s.active))
      )
        return s
      return {
        tabs: valid(s.tabs),
        favorites: valid(s.favorites),
        recent: valid(s.recent),
        active: s.active && ids.has(s.active) ? s.active : null,
      }
    })
    if (!restored) {
      restored = true
      const active = navigationSnapshot().active
      if (location.pathname === "/" && active && restoreLastBoard)
        navigate(active === "calendar" ? "~/calendar" : `~/d/${active}`)
    }
    if (id && ids.has(id)) {
      changeNavigation((s) => visitBoard(s, id))
      const board = boards.find((b) => b.id === id)
      if (board && id !== "calendar")
        setPreferences({ workspaceId: board.workspaceId ?? "default" })
    }
  }, [id, isPending, boards, navigate, restoreLastBoard])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (useTabs && e.ctrlKey && e.key === "Tab") {
        e.preventDefault()
        const target = nextBoardTab(navigationSnapshot(), e.shiftKey)
        if (target)
          navigate(target === "calendar" ? "~/calendar" : `~/d/${target}`)
      } else if (e.altKey && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault()
        if (e.key === "ArrowLeft") history.back()
        else history.forward()
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearch(true)
      }
    }
    const show = () => setSearch(true)
    window.addEventListener("keydown", key)
    window.addEventListener("bordena:search", show)
    return () => {
      window.removeEventListener("keydown", key)
      window.removeEventListener("bordena:search", show)
    }
  }, [navigate, useTabs])
  return (
    <>
      {useTabs && (
        <div
          role="tablist"
          aria-label={t("Открытые доски")}
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("Назад")}
            onClick={() => window.history.back()}
          >
            <ArrowLeft />
          </Button>
          {state.tabs.map((boardId) => {
            const board = boards.find((b) => b.id === boardId)
            return (
              board && (
                <div
                  key={boardId}
                  className="bordena-tab flex shrink-0 items-center rounded-md bg-muted/40"
                >
                  <button
                    role="tab"
                    aria-selected={id === boardId}
                    title={board.title}
                    onClick={() => open(boardId)}
                    className="max-w-72 truncate rounded-md px-3 py-2 text-sm focus-visible:outline-2 aria-selected:bg-accent"
                  >
                    {board.title}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("Закрыть вкладку: {p0}", { p0: board.title })}
                    onClick={() => {
                      const next = closeBoardTab(navigationSnapshot(), boardId)
                      changeNavigation(() => next)
                      if (id === boardId) open(next.active)
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              )
            )
          })}
          <CreateItemMenu label={t("Новая вкладка")} />
        </div>
      )}
      <QuickSearch open={search} onOpenChange={setSearch} />
    </>
  )
}
export function BoardShortcuts({
  onlyRecent = false,
}: {
  onlyRecent?: boolean
}) {
  const t = useT()
  const { data: boards = [] } = useDashboards()
  const state = useNavigation()
  const [, navigate] = useLocation()
  const render = (ids: string[], favorites: boolean) =>
    ids.map((id, index) => {
      const board = boards.find((b) => b.id === id)
      return (
        board && (
          <div className="flex items-center gap-1" key={id}>
            <button
              className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-2"
              onClick={() => navigate(`~/d/${id}`)}
            >
              {board.title}
            </button>
            {favorites && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!index}
                  aria-label={t("Выше в избранном: {p0}", { p0: board.title })}
                  onClick={() =>
                    changeNavigation((s) => {
                      const ids = [...s.favorites]
                      ;[ids[index - 1], ids[index]] = [
                        ids[index],
                        ids[index - 1],
                      ]
                      return { ...s, favorites: ids }
                    })
                  }
                >
                  <ChevronUp className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("Открепить: {p0}", { p0: board.title })}
                  onClick={() => toggleFavorite(id)}
                >
                  <Star className="size-3 fill-current" />
                </Button>
              </>
            )}
          </div>
        )
      )
    })
  if (onlyRecent)
    return (
      <>
        <SidebarSection id="favorites" title={t("Избранное")} closed>
          {render(state.favorites, true)}
        </SidebarSection>
        {state.recent.length > 0 && (
          <SidebarSection id="recent" title={t("Недавние")} closed>
            {render(state.recent.slice(0, 5), false)}
          </SidebarSection>
        )}
      </>
    )
  return (
    <div className="px-2">
      <button
        className="bordena-global-search flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent focus-visible:outline-2"
        onClick={() => window.dispatchEvent(new Event("bordena:search"))}
      >
        <Search className="size-4" /> {t("Поиск")}{" "}
        <span className="ml-auto text-xs text-muted-foreground">Ctrl+K</span>
      </button>
    </div>
  )
}
