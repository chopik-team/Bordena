import { formatLocalError } from "@/lib/local-error"
import { useState } from "react"
import { useT } from "@bordena/i18n"
import { useCard, useUpdateCard, type Card } from "@bordena/core"
import { Button, InvisibleInput } from "@bordena/ui-kit"
import { Pin } from "lucide-react"
import { invoke, convertFileSrc } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
interface Info {
  name: string
  size: number
  mime: string
  exists: boolean
}
export function ExternalMaterials({
  cardId,
  readonly,
}: {
  cardId: string
  readonly: boolean
}) {
  const t = useT(),
    { data: card } = useCard(cardId),
    { mutateAsync: save } = useUpdateCard(cardId),
    [error, setError] = useState(""),
    [view, setView] = useState<{
      id: string
      path: string
      mime: string
      exists: boolean
    } | null>(null),
    [busy, setBusy] = useState(false)
  const files = card?.externalFiles ?? []
  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    setError("")
    void action()
      .catch((e) => setError(formatLocalError(e)))
      .finally(() => setBusy(false))
  }
  const persist = (next: NonNullable<Card["externalFiles"]>) =>
    save({ externalFiles: next })
  async function pick(id?: string): Promise<void> {
    const path = await open({
      multiple: false,
      filters: [
        {
          name: t("Локальные материалы"),
          extensions: [
            "mp4",
            "webm",
            "mov",
            "mkv",
            "avi",
            "m4v",
            "mp3",
            "wav",
            "pdf",
            "docx",
            "xlsx",
            "pptx",
            "txt",
            "zip",
          ],
        },
      ],
    })
    if (!path || typeof path !== "string") return
    const info = await invoke<Info>("local_file_info", { path })
    if (!info.exists) throw new Error(t("Файл недоступен"))
    const record = {
      id: id ?? crypto.randomUUID(),
      path,
      name: info.name,
      size: info.size,
      mime: info.mime,
    }
    await persist(
      id
        ? files.map((f) => (f.id === id ? { ...f, ...record } : f))
        : [...files, record]
    )
  }
  if (readonly && !files.length) return null
  return (
    <div className="space-y-2 px-4 py-2 text-sm">
      {!readonly && (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run(() => pick())}
        >
          {t("Ссылка на видео / файл")}
        </Button>
      )}
      {!!files.length && (
        <p className="text-xs text-muted-foreground">
          {t("Внешние файлы не копируются в Bordena и резервные копии.")}
        </p>
      )}
      {[...files]
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
        .map((file) => (
          <div key={file.id} className="space-y-1 rounded border p-2">
            <div className="font-medium break-words">
              {file.pinned && <Pin className="mr-1 inline size-3" />}
              {file.group ? `${file.group} · ` : ""}
              {file.name}
            </div>
            <p className="text-xs break-all text-muted-foreground">
              {file.path} · {(file.size / 1048576).toFixed(1)} MiB
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const info = await invoke<Info>("local_file_info", {
                      path: file.path,
                    })
                    setView({
                      id: file.id,
                      path: file.path,
                      mime: info.mime,
                      exists: info.exists,
                    })
                  })
                }
              >
                {t("Предпросмотр / проверить")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    invoke<void>("open_local_file", { path: file.path })
                  )
                }
              >
                {t("Открыть в Windows")}
              </Button>
              {!readonly && (
                <>
                  <details className="w-full">
                    <summary className="cursor-pointer py-1 text-xs text-muted-foreground">
                      {t("Переименовать / группа")}
                    </summary>
                    <div className="flex flex-wrap gap-2 py-2">
                      <InvisibleInput
                        value={file.name}
                        label={t("Имя вложения")}
                        onCommit={(name) =>
                          name.trim() &&
                          run(() =>
                            persist(
                              files.map((f) =>
                                f.id === file.id
                                  ? { ...f, name: name.trim() }
                                  : f
                              )
                            )
                          )
                        }
                      />
                      <InvisibleInput
                        value={file.group ?? ""}
                        label={t("Группа вложения")}
                        onCommit={(group) =>
                          run(() =>
                            persist(
                              files.map((f) =>
                                f.id === file.id ? { ...f, group } : f
                              )
                            )
                          )
                        }
                      />
                    </div>
                  </details>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      run(() =>
                        persist(
                          files.map((f) =>
                            f.id === file.id ? { ...f, pinned: !f.pinned } : f
                          )
                        )
                      )
                    }
                  >
                    {t(file.pinned ? "Открепить" : "Закрепить")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(() => pick(file.id))}
                  >
                    {t("Изменить путь")}
                  </Button>
                  {([-1, 1] as const).map((direction) => (
                    <Button
                      key={direction}
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(async () => {
                          const index = files.findIndex(
                              (f) => f.id === file.id
                            ),
                            target = index + direction
                          if (target < 0 || target >= files.length) return
                          const next = [...files]
                          ;[next[index], next[target]] = [
                            next[target],
                            next[index],
                          ]
                          await persist(next)
                        })
                      }
                    >
                      {t(direction === -1 ? "Выше" : "Ниже")}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      run(() => persist(files.filter((f) => f.id !== file.id)))
                    }
                  >
                    {t("Отвязать")}
                  </Button>
                </>
              )}
            </div>
            {view?.id === file.id &&
              (!view.exists ? (
                <p role="status" className="text-destructive">
                  {t("Файл недоступен. Измените путь.")}
                </p>
              ) : view.mime.startsWith("video/") ? (
                <video
                  controls
                  preload="metadata"
                  className="max-h-80 w-full"
                  src={convertFileSrc(file.path)}
                  onError={() =>
                    setError(t("Формат не поддерживается локальным движком"))
                  }
                />
              ) : view.mime.startsWith("audio/") ? (
                <audio
                  controls
                  src={convertFileSrc(file.path)}
                  onError={() =>
                    setError(t("Формат не поддерживается локальным движком"))
                  }
                />
              ) : (
                <p>{t("Файл найден. Используйте открытие в Windows.")}</p>
              ))}
          </div>
        ))}
      {error && (
        <p role="alert" className="break-words text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
