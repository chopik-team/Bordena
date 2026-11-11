import type { ReactNode } from "react"

export function MdStrikethrough({ children }: { children: ReactNode }) {
  return <del className="line-through">{children}</del>
}
