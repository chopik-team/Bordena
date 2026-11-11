import { fsStorageFromEnv, type FsServerStorage } from "./fs-storage"
import { s3StorageFromEnv, type S3ServerStorage } from "./s3-storage"

/**
 * S3 configured storage vs local volume depending on the env vars
 */
export function storageFromEnv(
  env: NodeJS.ProcessEnv = process.env
): S3ServerStorage | FsServerStorage {
  return s3StorageFromEnv(env) ?? fsStorageFromEnv(env)
}
