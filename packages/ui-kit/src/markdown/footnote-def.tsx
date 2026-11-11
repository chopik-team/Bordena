import type { ReactNode } from "react"

/**
 * Rendered where it appears rather than collected into a section: card bodies
 * are short enough that a jump link would be noise.
 */
export function MdFootnoteDef({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="footnote-def flex gap-2 text-[0.875em] text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  )
}
