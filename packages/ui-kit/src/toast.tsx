import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"

interface ToastProps {
  visible: boolean
  children: ReactNode
}

export function Toast({ visible, children }: ToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="rounded-xl border bg-popover text-popover-foreground shadow-e3"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
