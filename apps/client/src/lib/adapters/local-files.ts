import { t } from "@bordena/i18n"
import type { Files, FileInput } from "@bordena/ports"
import { BLOBS, webDb } from "./web-db"
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/
const SAFE_KEY =
  /^att\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(\.[a-z0-9]+)?$/
export const MAX_FILE_BYTES = 32 * 1024 * 1024
export function blobKey(scope: string, key: string): string {
  if (!SAFE_ID.test(scope) || !SAFE_KEY.test(key))
    throw new Error(t("Недопустимый идентификатор вложения"))
  return `${scope}/${key}`
}
export class LocalFiles implements Files {
  async put(scope: string, input: FileInput) {
    if (input.bytes.size > MAX_FILE_BYTES)
      throw new Error(t("Вложение превышает 32 МиБ"))
    const extension = /\.([a-zA-Z0-9]{1,12})$/.exec(input.name)?.[1]
    const key = `att/${crypto.randomUUID()}${extension ? `.${extension.toLowerCase()}` : ""}`
    await webDb.set(BLOBS, blobKey(scope, key), input.bytes)
    return { key, mime: input.mime, size: input.bytes.size }
  }
  async get(scope: string, key: string): Promise<Blob> {
    const blob = await webDb.get<Blob>(BLOBS, blobKey(scope, key))
    if (!(blob instanceof Blob))
      throw new Error(t("Локальное вложение не найдено"))
    return blob
  }
  async url(scope: string, key: string): Promise<string> {
    return URL.createObjectURL(await this.get(scope, key))
  }
  async remove(scope: string, key: string): Promise<void> {
    await webDb.delete(BLOBS, blobKey(scope, key))
  }
}
export const localFiles = new LocalFiles()
