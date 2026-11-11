import type { MouseEvent } from "react"
import { cn } from "../lib/cn"

export function MdImage({
  src,
  alt,
  className,
  onClick,
  onError,
}: {
  src: string
  alt: string
  className?: string
  onClick?: (event: MouseEvent<HTMLImageElement>) => void
  onError?: () => void
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onClick={onClick}
      onError={onError}
      className={cn("my-4 block h-auto max-w-full rounded-lg", className)}
    />
  )
}
