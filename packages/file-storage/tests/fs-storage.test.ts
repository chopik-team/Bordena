import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { FILES_DIR, FsServerStorage, fsStorageFromEnv } from "../src/server/fs-storage"

let dir: string
let storage: FsServerStorage

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "doska-files-"))
  storage = new FsServerStorage({ dir })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function readBack(key: string): Promise<string> {
  const file = await storage.fetch(key)
  const chunks: Buffer[] = []
  for await (const chunk of file.body) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString()
}

const put = (name: string, mime: string, body = "hello") =>
  storage.put(Buffer.from(body), { name, mime })

describe("round trip", () => {
  test("put, fetch, remove", async () => {
    const stored = await put("note.txt", "text/plain")
    expect(stored).toMatchObject({ mime: "text/plain", size: 5 })
    expect(stored.key).toMatch(/^att\/[0-9a-f-]{36}\.txt$/)

    expect(await readBack(stored.key)).toBe("hello")

    await storage.remove(stored.key)
    await expect(storage.fetch(stored.key)).rejects.toThrow()
  })

  test("removing a missing blob is not an error", async () => {
    const { key } = await put("note.txt", "text/plain")
    await storage.remove(key)
    await expect(storage.remove(key)).resolves.toBeUndefined()
  })

  test("no temp file survives a completed upload", async () => {
    await put("note.txt", "text/plain")
    const written = await readdir(join(dir, "att"))
    expect(written.some((name) => name.endsWith(".tmp"))).toBe(false)
  })
})

describe("serve policy", () => {
  test("a known extension is served inline with its real type", async () => {
    const { key } = await put("shot.png", "image/png")
    const file = await storage.fetch(key)
    expect(file.contentType).toBe("image/png")
    expect(file.disposition).toBe("inline")
    expect(file.contentLength).toBe(5)
  })

  test("an unknown extension downloads", async () => {
    const { key } = await put("thing.bin", "application/x-thing")
    const file = await storage.fetch(key)
    expect(file.disposition).toBe("attachment")
  })

  test("a script-ish upload can't be served inline", async () => {
    const { key } = await put("evil.html", "text/html", "<script>x</script>")
    const file = await storage.fetch(key)
    expect(file.disposition).toBe("attachment")
    expect(file.contentType).toBe("application/octet-stream")
  })
})

describe("key validation", () => {
  const bad = [
    "../../etc/passwd",
    "att/../../etc/passwd",
    "att/not-a-uuid.png",
    "etc/passwd",
    "att/",
    "",
  ]

  test.each(bad)("fetch rejects %j", async (key) => {
    await expect(storage.fetch(key)).rejects.toThrow()
  })

  test("remove ignores a key it didn't mint", async () => {
    const outside = join(dir, "secret.txt")
    await writeFile(outside, "keep me")
    await storage.remove("../secret.txt")
    expect(await readdir(dir)).toContain("secret.txt")
  })
})

describe("fsStorageFromEnv", () => {
  test("always builds storage — the backend needs nothing provisioned", () => {
    expect(fsStorageFromEnv({})).toBeInstanceOf(FsServerStorage)
  })

  // The compose file mounts the doska-files volume at exactly this path. Change
  // one without the other and uploads land in the container's writable layer,
  // where they vanish on the next `docker compose pull`.
  test("defaults to the fixed path the compose volume mounts at", () => {
    expect(FILES_DIR).toBe("/data/files")
    expect(fsStorageFromEnv({})).toEqual(
      new FsServerStorage({ dir: FILES_DIR })
    )
  })

  test("only the override moves it — no operator-facing variable does", () => {
    expect(fsStorageFromEnv({ FILE_DIR_OVERRIDE: dir })).toEqual(
      new FsServerStorage({ dir })
    )
    for (const name of ["FILE_DIR", "FILES_DIR", "DATA_DIR"]) {
      expect(fsStorageFromEnv({ [name]: dir })).toEqual(
        new FsServerStorage({ dir: FILES_DIR })
      )
    }
  })

  test("honours FILE_MAX_BYTES", () => {
    expect(fsStorageFromEnv({ FILE_MAX_BYTES: "64" }).maxBytes).toBe(64)
  })

  test("falls back to the default cap on a junk FILE_MAX_BYTES", () => {
    expect(fsStorageFromEnv({ FILE_MAX_BYTES: "nonsense" }).maxBytes).toBe(
      25 * 1024 * 1024
    )
  })
})
