import { DateInput, DeadlineChip, cn } from "@bordena/ui-kit"

interface IProps {
  value: string | null
  onChange?: (value: string | null) => void
  className?: string
  done: boolean
}

/** Card deadline as a color-coded chip. */
export function CardDeadline({ value, onChange, className, done }: IProps) {
  // With no picker an empty deadline has nothing to show, and the bare calendar
  // icon the chip falls back to would read as a button that does nothing.
  if (!onChange)
    return value ? <DeadlineChip done={done} value={value} /> : null

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <DateInput
        withTime
        value={value}
        onChange={onChange}
        className={cn(
          "-m-1.5 cursor-pointer items-center gap-1.5 p-1.5 md:m-0 md:p-0",
          className
        )}
      >
        <DeadlineChip done={done} value={value} />
      </DateInput>
    </span>
  )
}
