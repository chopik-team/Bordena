import { S3FileStorage, type FileStorage } from "@bordena/file-storage"
import { appFetch } from "../fetch"
import { apiUrl } from "../server"
import { runtime } from "../../runtime"

/**
 * The backend attachments are read from and written to. Kept as a factory so a
 * second backend is a one-line change here rather than at every call site.
 */
export function createStorage(): FileStorage {
  return runtime().files ?? new S3FileStorage({ fetch: appFetch, apiUrl })
}

export const activeStorage = createStorage
