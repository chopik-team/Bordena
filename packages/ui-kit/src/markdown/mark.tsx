import type { ReactNode } from "react"

export function MdMark({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded-[0.2em] bg-[oklch(0.69_0.17_286.88_/_0.3)] px-[0.15em] text-inherit">
      {children}
    </mark>
  )
}
