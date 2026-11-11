import { describe, expect, test } from "vitest"
import { FsServerStorage } from "../src/server/fs-storage"
import { S3ServerStorage, s3StorageFromEnv } from "../src/server/s3-storage"
import { storageFromEnv } from "../src/server/storage-from-env"

describe("storageFromEnv", () => {
  test("no bucket → the local volume, with nothing configured", () => {
    expect(storageFromEnv({})).toBeInstanceOf(FsServerStorage)
  })

  test("S3_BUCKET → the bucket", () => {
    expect(storageFromEnv({ S3_BUCKET: "b" })).toBeInstanceOf(S3ServerStorage)
  })

  test("an empty S3_BUCKET is not a bucket", () => {
    expect(storageFromEnv({ S3_BUCKET: "" })).toBeInstanceOf(FsServerStorage)
  })
})

describe("s3StorageFromEnv", () => {
  test("null without a bucket", () => {
    expect(s3StorageFromEnv({})).toBeNull()
  })

  test("honours FILE_MAX_BYTES and ignores a junk one", () => {
    expect(
      s3StorageFromEnv({ S3_BUCKET: "b", FILE_MAX_BYTES: "64" })?.maxBytes
    ).toBe(64)
    expect(
      s3StorageFromEnv({ S3_BUCKET: "b", FILE_MAX_BYTES: "nope" })?.maxBytes
    ).toBe(25 * 1024 * 1024)
  })
})
