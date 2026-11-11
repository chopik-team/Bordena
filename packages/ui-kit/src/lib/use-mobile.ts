import { createContext, useContext, useEffect, useState } from "react"

const MOBILE_BREAKPOINT = 768

const MobileOverrideCtx = createContext<boolean | null>(null)

/** popout window. */
export const MobileOverride = MobileOverrideCtx.Provider

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const override = useContext(MobileOverrideCtx)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return override ?? isMobile
}
