import { t } from "@bordena/i18n"
export function formatLocalError(error: unknown): string {
  if (error instanceof Error && error.name === "ZodError")
    return t("Файл или форма содержат некорректные значения.")
  const message = (
    error instanceof Error ? error.message : String(error)
  ).replace(/^Error:\s*/, "")
  if (message.startsWith("ID conflict: "))
    return `${t("ID conflict")}: ${message.slice(13)}`
  return t(message)
}
