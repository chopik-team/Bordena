import { DateTimeCalendar } from "@bordena/ui-kit"

export default function DeadlineCalendar({
  value,
  onSelect,
}: {
  value: string | null
  onSelect: (value: string | null) => void
}) {
  return <DateTimeCalendar value={value} onSelect={onSelect} />
}
