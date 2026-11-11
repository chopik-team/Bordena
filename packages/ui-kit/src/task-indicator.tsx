import { cn } from "./lib/cn"
import { useIsMobile } from "./lib/use-mobile"

interface IProps {
  done: number
  total: number
}

const VIEWBOX = 16
const STROKE = 2
const RADIUS = (VIEWBOX - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CENTER = VIEWBOX / 2

export function TaskIndicator({ done, total }: IProps) {
  const isMobile = useIsMobile()
  const complete = total > 0 && done === total
  const progress = total === 0 ? 0 : done / total

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-mono",
        "text-muted-foreground tabular-nums",
        isMobile ? "text-sm" : "text-xs"
      )}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className={isMobile ? "size-4" : "size-3.5"}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-current opacity-30"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          // Starts the arc at 12 o'clock instead of 3.
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className="stroke-current transition-[stroke-dashoffset]"
        />
        {complete && (
          <path
            d="M4.8 8.2 L7 10.4 L11.2 6"
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-current"
          />
        )}
      </svg>
      <span className="mt-px">
        {done}/{total}
      </span>
    </span>
  )
}
