import type { MouseEvent, ReactNode } from "react"

function stopPropagation(event: MouseEvent) {
  event.stopPropagation()
}

/** A relative href stays in this tab; anything with a scheme or host leaves. */
function isExternal(href: string) {
  return /^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)
}

export function MdLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const external = isExternal(href)
  return (
    <a
      href={href}
      onClick={stopPropagation}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="hover:text-primary underline underline-offset-2 transition-[text-decoration-color] duration-150 hover:decoration-primary"
    >
      {children}
    </a>
  )
}
