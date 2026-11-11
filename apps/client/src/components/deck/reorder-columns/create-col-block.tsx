import { t } from "@bordena/i18n"
import type { Column } from "@bordena/contract"
import { cn } from "@bordena/ui-kit"
import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"
export function createColumnBlock(column: Column) {
  return (
    dragProvided: DraggableProvided,
    snapshot: DraggableStateSnapshot
  ) => (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      style={{
        ...dragProvided.draggableProps.style,
        ...(snapshot.isDropAnimating && {
          transitionDuration: "0.15s",
        }),
      }}
      className={cn(
        "mb-2 flex items-center gap-3 rounded-xl border bg-background px-3 py-3",
        "text-sm font-medium select-none",
        snapshot.isDragging && "shadow-e2"
      )}
    >
      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{column.title || t("Без названия")}</span>
    </div>
  )
}
