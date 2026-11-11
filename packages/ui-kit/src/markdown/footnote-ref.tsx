export function MdFootnoteRef({ label }: { label: string }) {
  return (
    <sup className="footnote-ref text-[0.75em] text-muted-foreground">
      {label}
    </sup>
  )
}
