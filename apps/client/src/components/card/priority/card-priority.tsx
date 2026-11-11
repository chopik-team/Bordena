import { useT } from "@bordena/i18n"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  PRIORITIES,
  PriorityChip,
  cn,
} from "@bordena/ui-kit"
import { Check, Flag } from "lucide-react"
interface IProps {
  value: string
  onChange?: (priority: string) => void
  className?: string
}
/** Card priority as a color-coded chip. */
export function CardPriority({ value, onChange, className }: IProps) {
  const t = useT()
  if (!onChange) return <PriorityChip value={value} className={className} />
  const isSet = PRIORITIES.some((p) => p.id === value)
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={t("Приоритет карточки")}
              className={cn(
                "-m-1.5 inline-flex cursor-pointer items-center p-1.5 md:m-0 md:p-0",
                className
              )}
            />
          }
        >
          {isSet ? (
            <PriorityChip value={value} />
          ) : (
            <Flag className="size-4 text-muted-foreground hover:text-foreground md:size-3.5" />
          )}
        </MenuTrigger>
        <MenuContent align="start">
          <MenuItem onClick={() => onChange("")}>
            <Flag className="size-4 text-muted-foreground md:size-3.5" />
            {t("No priority")} {!isSet && <Check className="ml-auto" />}
          </MenuItem>
          {PRIORITIES.map((option) => (
            <MenuItem key={option.id} onClick={() => onChange(option.id)}>
              <PriorityChip value={option.id} />
              {t(option.label)}
              {option.id === value && <Check className="ml-auto" />}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </span>
  )
}
