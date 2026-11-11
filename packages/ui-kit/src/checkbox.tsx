import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"
import { cn } from "./lib/cn"

interface IProps extends CheckboxPrimitive.Root.Props {
  variant?: "default" | "dashed"
}

export function Checkbox({ className, variant, ...props }: IProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border border-input",
        "bg-transparent text-primary transition-colors outline-none dark:text-primary-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-checked:border-primary data-checked:bg-primary/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "dashed" && "border-dashed hover:border-foreground/40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex data-unchecked:hidden">
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
