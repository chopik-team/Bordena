import { motion } from "motion/react"
import type { ReactNode } from "react"
import { REORDER_TRANSITION } from "@/lib/motion"
import { useIsBoardDragging } from "../deck/drag-state"

export function OrderAnimator({ children }: { children: ReactNode }) {
  const isDragging = useIsBoardDragging()

  return (
    <motion.div
      layout={isDragging ? false : "position"}
      transition={REORDER_TRANSITION}
    >
      {children}
    </motion.div>
  )
}
