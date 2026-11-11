import { Route, Switch } from "wouter"
import { BoardPage } from "@/components/app/board-page"
import { DigestPage } from "@/components/app/digest-page"
import { HomePage } from "@/components/app/home-page"
import { QuickNotePage } from "@/components/quick-note/quick-note-page"
import { CardWindowPage } from "@/components/card-window/card-window-page"
import { TrashPage } from "@/components/app/trash-page"
import { routes } from "./lib/routes"
import { CalendarPage } from "./components/calendar/calendar-page"

export function Router() {
  return (
    <Switch>
      <Route path="/calendar"><CalendarPage /></Route>
      <Route path={routes.digest()} nest>
        <DigestPage />
      </Route>
      <Route path={routes.trash()}>
        <TrashPage />
      </Route>
      <Route path={routes.quickNote()}>
        <QuickNotePage />
      </Route>
      <Route path={routes.cardWindow.pattern}>
        {(params) => <CardWindowPage cardId={params.id} />}
      </Route>
      <Route path={routes.deck.pattern} nest>
        {(params) => <BoardPage deckId={params.id} />}
      </Route>
      <Route>
        <HomePage />
      </Route>
    </Switch>
  )
}
