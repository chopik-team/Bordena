import { createContext, useContext } from "react"

const DragStateCtx = createContext(false)

export const DragStateProvider = DragStateCtx.Provider

export function useIsBoardDragging() {
  return useContext(DragStateCtx)
}
