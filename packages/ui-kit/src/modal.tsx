import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { Button } from "./button"
import { cn } from "./lib/cn"
import { useT } from "@bordena/i18n"

function Modal({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="modal" {...props} />
}

function ModalContent({
  className,
  children,
  padding = "default",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  padding?: "default" | "none"
  showCloseButton?: boolean
}) {
  const t = useT()
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="modal-overlay"
        forceRender
        className={cn(
          "fixed inset-0 z-50 bg-sidebar/50 supports-backdrop-filter:backdrop-blur-xs",
          "transition-opacity duration-200",
          "data-ending-style:opacity-0 data-starting-style:opacity-0"
        )}
      />
      <DialogPrimitive.Popup
        data-slot="modal-content"
        className={cn(
          // mobile: full-screen page
          "fixed inset-0 z-50 flex min-w-0 flex-col bg-card text-sm text-popover-foreground",
          // desktop: centered modal (height is set per-state by the consumer so
          // it can transition smoothly between preview/editing)
          "md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:max-h-[90svh] md:w-full md:max-w-2xl md:rounded-xl md:border md:shadow-e3",
          // fade + scale on open/close, and animate the height change on resize
          "transition-all duration-200 ease-out",
          "data-ending-style:opacity-0 data-starting-style:opacity-0",
          "md:data-ending-style:scale-95 md:data-starting-style:scale-95",
          padding === "default" && "p-5 sm:p-6",
          showCloseButton && "[&>[data-slot=modal-title]]:pr-10",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                tooltip={false}
                aria-label={t("Закрыть")}
                className="absolute top-4 right-4 z-10 shrink-0 text-muted-foreground hover:text-foreground"
              />
            }
          >
            <X aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export function ModalContentCentered({
  children,
  className,
}: React.PropsWithChildren & { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col justify-center gap-2 md:flex-none",
        className
      )}
    >
      {children}
    </div>
  )
}

function ModalTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="modal-title"
      className={cn(
        "min-w-0 font-heading text-base font-medium break-words text-foreground [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  )
}

function ModalHeader({
  children,
  onClose,
  className,
}: React.PropsWithChildren<{ onClose?: () => void; className?: string }>) {
  const t = useT()
  return (
    <div
      data-slot="modal-header"
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 px-4 py-3",
        // full-screen below md, so it sits under the traffic lights
        "max-md:in-[.window-controls]:pl-24",
        className
      )}
    >
      <ModalTitle>{children}</ModalTitle>
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("Закрыть")}
          tooltip={false}
          className="shrink-0 self-start text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X />
        </Button>
      )}
    </div>
  )
}

function ModalDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="modal-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

const ModalClose = DialogPrimitive.Close

export {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalClose,
}
