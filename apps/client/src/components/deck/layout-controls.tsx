import { useUiFlag } from "@/lib/ui-state"
import { useT } from "@bordena/i18n"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  keys,
  queryClient,
  useBoard,
  sectionPlacement,
  type Dashboard,
  type LayoutMode,
} from "@bordena/core"
import {
  Button,
  Modal,
  ModalContent,
  ModalTitle,
  InvisibleInput,
} from "@bordena/ui-kit"

import { ensureLayout } from "@/lib/layout-workspace"
import { useLayoutChange } from "@/lib/hooks/use-layout-change"
import { ColorSelect } from "../column/column-color"
export function LayoutControls({
  dashboard,
  open: controlledOpen,
  onOpenChange,
  dialogOnly = false,
}: {
  dashboard: Dashboard
  open?: boolean
  onOpenChange?: (value: boolean) => void
  dialogOnly?: boolean
}) {
  const [fillWidth, setFillWidth] = useUiFlag(
    "board-fill:" + dashboard.id,
    true
  )
  const t = useT()
  const [localSettings, setLocalSettings] = useState(false)
  const settings = controlledOpen ?? localSettings
  const setSettings = onOpenChange ?? setLocalSettings
  const { mutate: change, isPending } = useLayoutChange(dashboard.id)
  const mode = useMutation({
    mutationFn: (value: LayoutMode) => ensureLayout(dashboard.id, value),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: keys.dashboards }),
  })
  const layout = dashboard.layout
  const { data: board } = useBoard(dashboard.id)
  const busy = isPending || mode.isPending
  return (
    <div
      className={
        dialogOnly
          ? "contents"
          : "flex flex-wrap items-center gap-3 px-4 pb-3 xs:px-6"
      }
    >
      {!dialogOnly && (
        <Button size="sm" variant="ghost" onClick={() => setSettings(true)}>
          {t("Компоновка…")}
        </Button>
      )}
      {mode.isError && (
        <span role="alert" className="text-xs text-destructive">
          {String(mode.error?.message)}
        </span>
      )}
      <Modal open={settings} onOpenChange={setSettings}>
        <ModalContent className="max-h-[85vh] overflow-y-auto md:max-w-xl">
          <ModalTitle>{t("Компоновка доски")}</ModalTitle>
          <select
            aria-label={t("Компоновка доски")}
            value={layout?.mode ?? "legacy"}
            disabled={busy}
            onChange={(e) => mode.mutate(e.target.value as LayoutMode)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {!layout && <option value="legacy">{t("Колонки 0.1")}</option>}
            <option value="free">{t("Свободная")}</option>
            <option value="matrix">{t("Матрица")}</option>
          </select>
          <p className="my-3 text-xs text-muted-foreground">
            {t(
              "Свободная компоновка запоминает секции. Матрица использует отдельные этапы и состояния. Переключение сохраняет обе позиции и все карточки."
            )}{" "}
          </p>
          {layout?.mode === "free" && (
            <div>
              <label className="my-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fillWidth}
                  onChange={(e) => setFillWidth(e.currentTarget.checked)}
                />
                {t("Заполнять ширину окна")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Столбцы делят свободное место. Отключите, чтобы вернуть фиксированную ширину. Настройка сохраняется на этом устройстве."
                )}
              </p>
            </div>
          )}
          {layout && (
            <>
              {layout.mode === "free" && (
                <div className="my-3 flex flex-wrap gap-2">
                  {["all", "none", "done"].map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        change((l) => ({
                          ...l,
                          sections: {
                            ...l.sections,
                            ...Object.fromEntries(
                              (board?.columns ?? [])
                                .filter(
                                  (column) => value !== "done" || column.done
                                )
                                .map((column) => [
                                  column.id,
                                  {
                                    ...sectionPlacement(l, column),
                                    collapsed: value !== "none",
                                  },
                                ])
                            ),
                          },
                        }))
                      }
                    >
                      {t(
                        value === "all"
                          ? "Свернуть все секции"
                          : value === "none"
                            ? "Развернуть все секции"
                            : "Свернуть выполненные секции"
                      )}
                    </Button>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={layout.tint ?? false}
                  disabled={busy}
                  onChange={(e) => {
                    const tint = e.currentTarget.checked
                    change((l) => ({ ...l, tint }))
                  }}
                />
                {t("Лёгкая тонировка фона")}{" "}
              </label>
              {(
                [
                  ["lanes", t("Столбцы свободной компоновки")],
                  ["stages", t("Этапы матрицы")],
                  ["states", t("Состояния матрицы")],
                ] as const
              ).map(([field, label]) => (
                <section className="mt-4 space-y-2" key={field}>
                  <h3 className="text-sm font-semibold">{label}</h3>
                  {layout[field].map((item, index) => (
                    <div className="flex items-center gap-2" key={item.id}>
                      <InvisibleInput
                        value={item.title}
                        label={t("{p0}: название {p1}", {
                          p0: label,
                          p1: index + 1,
                        })}
                        className="min-w-0 flex-1"
                        onCommit={(title) =>
                          change((l) => ({
                            ...l,
                            [field]: l[field].map((x) =>
                              x.id === item.id ? { ...x, title } : x
                            ),
                          }))
                        }
                      />
                      <ColorSelect
                        label={t("Цвет: {p0}", { p0: item.title })}
                        value={item.color}
                        onChange={(color) =>
                          change((l) => ({
                            ...l,
                            [field]: l[field].map((x) =>
                              x.id === item.id ? { ...x, color } : x
                            ),
                          }))
                        }
                      />
                      {field === "states" && (
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={item.done ?? false}
                            disabled={busy}
                            onChange={(event) => {
                              const done = event.currentTarget.checked
                              change((l) => ({
                                ...l,
                                states: l.states.map((s) =>
                                  s.id === item.id ? { ...s, done } : s
                                ),
                              }))
                            }}
                          />
                          {t("Считать выполненным")}
                        </label>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!index || busy}
                        aria-label={t("Выше: {p0}", { p0: item.title })}
                        onClick={() =>
                          change((l) => {
                            const items = [...l[field]]
                            ;[items[index - 1], items[index]] = [
                              items[index],
                              items[index - 1],
                            ]
                            return { ...l, [field]: items }
                          })
                        }
                      >
                        ↑
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="muted"
                    disabled={busy}
                    onClick={() =>
                      change((l) => ({
                        ...l,
                        [field]: [
                          ...l[field],
                          {
                            id: crypto.randomUUID(),
                            title:
                              field === "states"
                                ? t("Новое состояние")
                                : field === "stages"
                                  ? t("Новый этап")
                                  : t("Новый столбец"),
                            color: "",
                          },
                        ],
                      }))
                    }
                  >
                    {t("Добавить")}{" "}
                    {field === "states"
                      ? t("состояние")
                      : field === "stages"
                        ? t("этап")
                        : t("столбец")}
                  </Button>
                </section>
              ))}
              {isPending && <p className="mt-2 text-xs">{t("Сохранение…")}</p>}
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
