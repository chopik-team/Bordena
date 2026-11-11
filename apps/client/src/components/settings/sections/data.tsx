import { useT } from "@bordena/i18n"
import { useEffect, useState } from "react"
import { Button } from "@bordena/ui-kit"
import { SettingsSection } from "../section"
import {
  type ImportPayload,
  decodeImport,
  encodeArchive,
  encodeJson,
} from "@/lib/exchange/format"
import {
  exportWorkspace,
  createBackup,
  previewImport,
  applyImport,
  listBackups,
  readBackup,
  type ImportPreview,
  type BackupRecord,
  pruneAutomaticBackups,
} from "@/lib/exchange/workspace"
import { pickExchange, saveExchange } from "@/lib/exchange/files"
import { useNavigation } from "@/lib/navigation"
import { isDesktop } from "@/lib/platform"
import { applyChangeset, undoChangeset } from "@/lib/exchange/changeset"
import { MAX_JSON_BYTES } from "@/lib/exchange/format"
import { usePreferences, setPreferences } from "@/lib/preferences"
import { webDb, BACKUPS } from "@/lib/adapters/web-db"
import { formatLocalError } from "@/lib/local-error"
export function DataSection() {
  const t = useT()
  const { active } = useNavigation()
  const [storagePath, setStoragePath] = useState("")
  const [lastBackup, setLastBackup] = useState("")
  const preferences = usePreferences()
  const [backups, setBackups] = useState<Omit<BackupRecord, "bytes">[]>([])
  const refreshBackup = () =>
    listBackups().then((records) => {
      setLastBackup(records[0]?.createdAt ?? "")
      setBackups(
        records.map(({ bytes, ...record }) => ({
          ...record,
          size: bytes.length,
        }))
      )
    })
  useEffect(() => {
    void refreshBackup().catch(() => {})
    if (isDesktop())
      void import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke<string>("storage_profile"))
        .then(setStoragePath)
        .catch(() => {})
  }, [])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState(false)
  const [pending, setPending] = useState<{
    payload: ImportPayload
    preview: ImportPreview
  } | null>(null)
  const [mode, setMode] = useState<"add" | "replace">("add")
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    setError(false)
    try {
      await action()
    } catch (e) {
      setError(true)
      setMessage(formatLocalError(e))
      console.error("Bordena data operation failed") // no filenames, notes or imported content in logs
    } finally {
      void refreshBackup().catch(() => {})
      setBusy(false)
    }
  }
  async function stage(payload: ImportPayload) {
    setMode("add")
    setPending({ payload, preview: await previewImport(payload) })
  }
  return (
    <SettingsSection title={t("Данные и резервные копии")}>
      <p className="text-xs text-muted-foreground">
        {t(
          "Все доски и вложения хранятся на этом компьютере. Экспортируйте копию на другой диск для защиты от его поломки."
        )}{" "}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !!pending}
          onClick={() =>
            void run(async () => {
              const bytes = await pickExchange()
              if (!bytes) return
              if (bytes.length > MAX_JSON_BYTES)
                throw new Error(t("JSON превышает 16 МиБ"))
              const result = await applyChangeset(
                JSON.parse(new TextDecoder().decode(bytes))
              )
              setMessage(
                t(
                  result.status === "duplicate"
                    ? "Этот Changeset уже применён"
                    : "Changeset применён и проверен"
                )
              )
            })
          }
        >
          {t("Применить Changeset")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !!pending}
          onClick={() =>
            void run(async () => {
              await undoChangeset()
              setMessage(t("Changeset отменён"))
            })
          }
        >
          {t("Отменить Changeset")}
        </Button>
        {active && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !!pending}
            onClick={() =>
              void run(async () => {
                const payload = await exportWorkspace(active),
                  files = payload.files.size > 0
                if (
                  await saveExchange(
                    files
                      ? await encodeArchive(payload)
                      : encodeJson(payload.document),
                    files ? "zip" : "json",
                    "board"
                  )
                )
                  setMessage(t("Экспорт сохранён и проверен"))
              })
            }
          >
            {t("Экспорт текущей доски")}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !!pending}
          onClick={() =>
            void run(async () => {
              const payload = await exportWorkspace()
              const hasFiles = payload.files.size > 0
              const bytes = hasFiles
                ? await encodeArchive(payload)
                : encodeJson(payload.document)
              if (await saveExchange(bytes, hasFiles ? "zip" : "json"))
                setMessage(t("Экспорт сохранён и проверен"))
            })
          }
        >
          {t("Экспорт всех досок")}{" "}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !!pending}
          onClick={() =>
            void run(async () => {
              const record = await createBackup()
              const saved = await saveExchange(record.bytes, "zip", "backup")
              setMessage(
                saved
                  ? t("Резервная копия сохранена и проверена")
                  : t(
                      "Копия сохранена в профиле Bordena; внешнее сохранение отменено"
                    )
              )
            })
          }
        >
          {t("Создать резервную копию")}{" "}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !!pending}
          onClick={() =>
            void run(async () => {
              const bytes = await pickExchange()
              if (bytes) await stage(await decodeImport(bytes))
            })
          }
        >
          {t("Импорт / восстановление")}{" "}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !!pending}
          onClick={() =>
            void run(async () => {
              const records = await listBackups()
              if (!records.length) {
                setMessage(t("В профиле пока нет резервных копий"))
                return
              }
              await stage(await readBackup(records[0]))
              setMessage(
                t("Копия от {p0}", {
                  p0: new Date(records[0].createdAt).toLocaleString("ru-RU"),
                })
              )
            })
          }
        >
          {t("Последняя локальная копия")}{" "}
        </Button>
      </div>
      <dl className="space-y-2 text-xs break-all text-muted-foreground">
        <div>
          <dt>{t("Папка данных")}</dt>
          <dd className="select-text">
            {storagePath || t("Локальный профиль Bordena")}
          </dd>
        </div>
        <div>
          <dt>{t("Последняя проверенная локальная копия")}</dt>
          <dd>
            {lastBackup
              ? new Date(lastBackup).toLocaleString()
              : t("Ещё не создана")}
          </dd>
        </div>
      </dl>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        {t("Автоматические копии")}
        <input
          aria-label={t("Автоматические копии")}
          type="number"
          min="0"
          max="100"
          className="w-20 rounded border bg-background p-2"
          value={preferences.automaticBackups}
          onChange={(e) => {
            const value = Number(e.target.value)
            if (Number.isInteger(value) && value >= 0 && value <= 100)
              setPreferences({ automaticBackups: value })
          }}
        />
        <span className="text-xs text-muted-foreground">
          {t("По умолчанию 3. Ручные копии сохраняются.")}
        </span>
      </label>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await pruneAutomaticBackups()
            setMessage(t("Лимит применён"))
          })
        }
      >
        {t("Применить лимит копий")}
      </Button>
      <details>
        <summary className="cursor-pointer py-2 text-sm font-medium">
          {t("История резервных копий")} ({backups.length})
        </summary>
        <div className="space-y-2">
          {backups.map((record) => (
            <div
              key={record.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"
            >
              <div>
                <p>{new Date(record.createdAt).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {t(record.kind ?? "manual")} · {record.reason ?? ""} ·{" "}
                  {Math.round(
                    (record as Omit<BackupRecord, "bytes"> & { size: number })
                      .size / 1024
                  )}{" "}
                  KiB
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !!pending}
                onClick={() =>
                  void run(async () => {
                    const saved = await webDb.get<BackupRecord>(
                      BACKUPS,
                      record.id
                    )
                    if (!saved) throw new Error(t("Копия недоступна"))
                    await stage(await readBackup(saved))
                    setMode("replace")
                    setMessage(t("Целостность копии проверена"))
                  })
                }
              >
                {t("Проверить и восстановить")}
              </Button>
            </div>
          ))}
        </div>
      </details>
      {pending && (
        <div className="space-y-3 rounded-md border p-3 text-sm">
          <p>
            {t("Будет импортировано: досок —")} {pending.preview.boards}
            {t(", колонок —")} {pending.preview.columns}
            {t(", карточек —")} {pending.preview.cards}
            {t(", вложений —")} {pending.preview.attachments}.
          </p>
          <p>
            {t("Конфликтов ID:")} {pending.preview.conflicts}
            {t(". Сейчас в пространстве досок:")}{" "}
            {pending.preview.existingBoards}.
          </p>
          <label className="flex gap-2">
            <input
              type="radio"
              name="import-mode"
              checked={mode === "add"}
              onChange={() => setMode("add")}
            />
            {t("Добавить доски (совпадение ID отменяет импорт)")}{" "}
          </label>
          <label className="flex gap-2">
            <input
              type="radio"
              name="import-mode"
              checked={mode === "replace"}
              disabled={pending.payload.document.scope !== "workspace"}
              onChange={() => setMode("replace")}
            />
            {t("Заменить всё пространство")}{" "}
          </label>
          {mode === "replace" && (
            <p className="text-destructive">
              {t(
                "Все текущие доски будут заменены. Перед записью Bordena создаст и проверит локальную резервную копию."
              )}{" "}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                busy || (mode === "add" && pending.preview.conflicts > 0)
              }
              onClick={() =>
                void run(async () => {
                  await applyImport(pending.payload, mode, pending.preview)
                  window.location.assign("/")
                })
              }
            >
              {t("Подтвердить импорт")}{" "}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              {t("Отмена")}{" "}
            </Button>
          </div>
        </div>
      )}
      {(busy || message) && (
        <p
          role={error ? "alert" : "status"}
          className={
            error ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {busy ? t("Проверка и запись…") : message}
        </p>
      )}
    </SettingsSection>
  )
}
