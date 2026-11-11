import { useLocale, useT } from "@bordena/i18n"
import { useState } from "react"
import { Modal, ModalContent, ModalHeader, Markdown } from "@bordena/ui-kit"
import { QuickNoteSection } from "./sections/quick-note"
import { DataSection } from "./sections/data"
import { InterfaceSection, BoardsSection } from "./sections/interface"
import { AboutSection } from "./sections/about"
import { GuideSection } from "./sections/guide"
import { NotificationsSection } from "./sections/notifications"
import changelog from "../../../../../CHANGELOG.md?raw"
import changelogEn from "../../../../../CHANGELOG.en.md?raw"
export type SettingsPage =
  | "interface"
  | "boards"
  | "data"
  | "about"
  | "guide"
  | "changes"
  | "notifications"
const pages: [SettingsPage, string][] = [
  ["interface", "Интерфейс"],
  ["boards", "Доски и управление"],
  ["data", "Данные"],
  ["notifications", "Уведомления"],
  ["about", "О программе"],
  ["guide", "Руководство пользователя"],
  ["changes", "История изменений"],
]
export function SettingsModal({
  open,
  onOpenChange,
  initialPage = "interface",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPage?: SettingsPage
}) {
  const t = useT(),
    [page, setPage] = useState<SettingsPage>(initialPage)
  const locale = useLocale()
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        padding="none"
        showCloseButton={false}
        className="md:h-[min(720px,88svh)] md:max-w-3xl"
      >
        <ModalHeader onClose={() => onOpenChange(false)}>
          {t("Настройки Bordena")}
        </ModalHeader>
        <div className="flex min-h-0 flex-1 flex-col border-t sm:flex-row">
          <nav
            aria-label={t("Разделы настроек")}
            className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:w-44 sm:flex-col sm:border-r sm:border-b-0"
          >
            {pages.map(([id, label]) => (
              <button
                key={id}
                aria-current={page === id ? "page" : undefined}
                className="shrink-0 rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 aria-current:bg-accent"
                onClick={() => setPage(id)}
              >
                {t(label)}
              </button>
            ))}
          </nav>
          <div
            className="min-h-0 min-w-0 flex-1 overflow-y-auto"
            data-settings-page={page}
          >
            {page === "interface" && <InterfaceSection />}
            {page === "boards" && (
              <>
                <BoardsSection />
                <QuickNoteSection />
              </>
            )}
            {page === "data" && <DataSection />}
            {page === "notifications" && <NotificationsSection />}
            {page === "about" && <AboutSection />}
            {page === "guide" && <GuideSection />}
            {page === "changes" && (
              <div className="p-4">
                <Markdown>{locale === "ru" ? changelog : changelogEn}</Markdown>
              </div>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}
