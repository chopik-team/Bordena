import { useT } from "@bordena/i18n"
import {
  Button,
  MenuItem,
  MenuSeparator,
  Modal,
  ModalContent,
  ModalTitle,
} from "@bordena/ui-kit"
import type { BoardLayout } from "@bordena/core"
import { ArrowUp, ArrowDown, Settings2 } from "lucide-react"
interface Props {
  title: string
  layout: BoardLayout
  laneId: string
  mode: "off" | "manual" | "position"
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
  onLane: (id: string) => void
  onMode: (mode: "off" | "manual" | "position") => void
}
export function SectionCommands({
  canUp,
  canDown,
  onUp,
  onDown,
  onSettings,
}: Pick<Props, "canUp" | "canDown" | "onUp" | "onDown"> & {
  onSettings: () => void
}) {
  const t = useT()
  return (
    <>
      <MenuItem disabled={!canUp} onClick={onUp}>
        <ArrowUp />
        {t("Переместить выше")}
      </MenuItem>
      <MenuItem disabled={!canDown} onClick={onDown}>
        <ArrowDown />
        {t("Переместить ниже")}
      </MenuItem>
      <MenuItem onClick={onSettings}>
        <Settings2 />
        {t("Настройки секции")}
      </MenuItem>
      <MenuSeparator />
    </>
  )
}
export function SectionOptions({
  title,
  layout,
  laneId,
  mode,
  onLane,
  onMode,
  open,
  onOpenChange,
}: Pick<Props, "title" | "layout" | "laneId" | "mode" | "onLane" | "onMode"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent className="md:max-w-md">
          <ModalTitle>
            {t("Секция:")} {title}
          </ModalTitle>
          <label className="mt-4 block text-sm">
            {t("Перенести в столбец")}
            <select
              aria-label={t("Перенести в столбец")}
              className="mt-1 w-full rounded-md border bg-background p-2"
              value={laneId}
              onChange={(e) => onLane(e.target.value)}
            >
              {layout.lanes.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm">
            {t("Показывать готовность")}
            <select
              aria-label={t("Готовность секции")}
              className="mt-1 w-full rounded-md border bg-background p-2"
              value={mode}
              onChange={(e) => onMode(e.target.value as typeof mode)}
            >
              <option value="off">{t("Выключено")}</option>
              <option value="manual">{t("Ручная готовность")}</option>
              <option value="position">{t("По порядку карточек")}</option>
            </select>
          </label>
          <p className="mt-3 text-xs text-muted-foreground">
            {t(
              "Позиционный процент отражает место карточки в последовательности, а не реальную оценку выполненной работы. Ручные значения сохраняются отдельно. Для одной карточки процент не определяется."
            )}
          </p>
          <Button className="mt-4" onClick={() => onOpenChange(false)}>
            {t("Готово")}
          </Button>
        </ModalContent>
      </Modal>
    </>
  )
}
