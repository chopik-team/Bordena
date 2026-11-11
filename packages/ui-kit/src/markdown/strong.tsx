import type { ReactNode } from "react"

export function MdStrong({ children }: { children: ReactNode }) {
  return <strong className="font-bold">{children}</strong>
}
