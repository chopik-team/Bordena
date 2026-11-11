import type { ReactNode } from "react"

export function MdTable({
  head,
  children,
}: {
  head?: ReactNode
  children: ReactNode
}) {
  return (
    <table className="my-2.5 w-full border-collapse text-[0.8125rem]">
      {head && <thead>{head}</thead>}
      <tbody>{children}</tbody>
    </table>
  )
}
