import type { ReactNode } from "react"

export function MdEmphasis({ children }: { children: ReactNode }) {
  return <em className="italic">{children}</em>
}
