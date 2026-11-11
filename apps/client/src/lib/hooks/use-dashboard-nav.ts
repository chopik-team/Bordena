import { useLocation } from "wouter"
import { routes } from "@/lib/routes"

/** Open a board, or create one and open it. Side-effect free. */
export function useDashboardNav() {
  const [, navigate] = useLocation()

  function selectDashboard(id: string) {
    navigate(`~${routes.deck.to(id)}`)
  }

  function createAndOpenDashboard() {
    window.dispatchEvent(new Event("bordena:create-board"))
  }

  return { selectDashboard, createAndOpenDashboard }
}
