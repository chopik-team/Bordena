export interface ColumnColor {
  /** Stored on the column; stable, so renaming a label never re-colors a board. */
  id: string
  label: string
  /** oklch hue, fed to `--column-h` / `--wikilink-h` by whatever renders it. */
  hue: number
}

/**
 * The colors a column can be tinted with. Hues only — each surface picks its
 * own lightness and chroma so a pill, a dot and a header accent stay legible
 * in both themes. A column with no color (`""`) renders neutral.
 */
export const COLUMN_COLORS: ColumnColor[] = [
  { id: "rose", label: "Розовый", hue: 10 },
  { id: "orange", label: "Оранжевый", hue: 45 },
  { id: "amber", label: "Янтарный", hue: 70 },
  { id: "lime", label: "Лаймовый", hue: 110 },
  { id: "green", label: "Зелёный", hue: 145 },
  { id: "teal", label: "Бирюзовый", hue: 195 },
  { id: "cyan", label: "Голубой", hue: 215 },
  { id: "blue", label: "Синий", hue: 240 },
  { id: "indigo", label: "Индиго", hue: 265 },
  { id: "violet", label: "Фиолетовый", hue: 285 },
  { id: "magenta", label: "Пурпурный", hue: 320 },
  { id: "pink", label: "Светло-розовый", hue: 350 },
]

/** The hue for a stored color id, or null when unset or no longer in the palette. */
export function columnHue(color: string): number | null {
  return COLUMN_COLORS.find((c) => c.id === color)?.hue ?? null
}

export interface ColumnSwatch {
  dot: string
  ring: string
}

/**
 * The swatch dot as sRGB. The web states it as `oklch(0.72 0.14 <hue>)` for the
 * fill and `oklch(0.62 0.15 <hue>)` for the ring; React Native parses neither,
 * so the same colors are resolved here. Regenerate if either lightness or
 * chroma changes above.
 */
const SWATCH: Record<string, ColumnSwatch> = {
  rose: { dot: "#ee7c90", ring: "#cf5971" },
  orange: { dot: "#eb8656", ring: "#cd632d" },
  amber: { dot: "#dc932e", ring: "#be7200" },
  lime: { dot: "#aaac31", ring: "#8d8d00" },
  green: { dot: "#67bb6b", ring: "#409d48" },
  teal: { dot: "#00bfc0", ring: "#00a0a2" },
  cyan: { dot: "#00b9db", ring: "#009bbe" },
  blue: { dot: "#3faff3", ring: "#008fd6" },
  indigo: { dot: "#79a1fc", ring: "#5981e0" },
  violet: { dot: "#9c96f8", ring: "#7f76dc" },
  magenta: { dot: "#cb86db", ring: "#ad65be" },
  pink: { dot: "#e57db1", ring: "#c65b93" },
}

/** The fill and ring for a palette color id, or `null` when it names none. */
export function columnSwatch(color: string): ColumnSwatch | null {
  return (columnHue(color) === null ? null : SWATCH[color]) ?? null
}
