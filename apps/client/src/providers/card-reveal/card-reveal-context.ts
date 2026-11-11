import { createContext, useContext } from "react"

export interface CardRevealValue {
  revealed: string | null
  reveal: (id: string) => void
}

export const CardRevealCtx = createContext<CardRevealValue>({
  revealed: null,
  reveal: () => {},
})

export function useRevealCard() {
  return useContext(CardRevealCtx).reveal
}

export function useIsRevealed(id: string) {
  return useContext(CardRevealCtx).revealed === id
}
