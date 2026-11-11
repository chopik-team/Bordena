import { useT } from "@bordena/i18n"
import {
  COLUMN_COLORS,
  MenuContent,
  MenuItem,
  MenuSub,
  MenuSubTrigger,
  Menu,
  MenuTrigger,
  Button,
} from "@bordena/ui-kit"
import { Check } from "lucide-react"
import { ColumnSwatch } from "./column-swatch"
interface IProps {
  color: string
  onChange: (color: string) => void
}
/** Reuses the same palette for the direct swatch and the section menu. */
function ColorItems({ color, onChange }: IProps) {
  const t = useT()
  return (
    <>
      {[{ id: "", label: "Без цвета" }, ...COLUMN_COLORS].map((option) => (
        <MenuItem key={option.id} onClick={() => onChange(option.id)}>
          <ColumnSwatch color={option.id} />
          {t(option.label)}
          {option.id === color && <Check className="ml-auto" />}
        </MenuItem>
      ))}
    </>
  )
}
export function ColumnColorPicker(props: IProps & { label?: string }) {
  const t = useT()
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={props.label ?? t("Выбрать цвет секции")}
          />
        }
      >
        <ColumnSwatch color={props.color} />
      </MenuTrigger>
      <MenuContent>
        <ColorItems {...props} />
      </MenuContent>
    </Menu>
  )
}
/** Picks a column's color, nested inside the column's actions menu. */
export function ColumnColorSubmenu({ color, onChange }: IProps) {
  const t = useT()
  return (
    <MenuSub>
      <MenuSubTrigger>
        <ColumnSwatch color={color} />
        {t("Цвет")}{" "}
      </MenuSubTrigger>
      <MenuContent align="start">
        <ColorItems color={color} onChange={onChange} />
      </MenuContent>
    </MenuSub>
  )
}

export function ColorSelect({
  value,
  onChange,
  label,
}: {
  value?: string
  onChange: (value: string) => void
  label: string
}) {
  const t = useT()
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-28 rounded border bg-background px-1 py-1 text-xs"
    >
      <option value="">{t("Без цвета")}</option>
      {COLUMN_COLORS.map((c) => (
        <option key={c.id} value={c.id}>
          {t(c.label)}
        </option>
      ))}
    </select>
  )
}
