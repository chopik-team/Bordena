/**
 * Saves a same-origin URL to the user's device as `name`.
 *
 * Deliberately an anchor click rather than `window.open`: an installed PWA runs
 * standalone, so a same-origin, in-scope URL opens in the app's own window —
 * which has no tabs, no back button, and no way out of the file.
 */
function downloadUrl(url: string, name: string): void {
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function downloadBlob(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      // Dismissing the sheet is a cancel, not a failure to fall back from.
      if (e instanceof DOMException && e.name === "AbortError") return
    }
  }

  const url = URL.createObjectURL(blob)
  downloadUrl(url, name)
  // Revoking straight away can cancel the download that just started.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Saves `bytes` into the user's Downloads folder as `name` and reveals it in
 * the OS file manager. Desktop only.
 */
export async function revealInDownloads(
  name: string,
  bytes: Uint8Array
): Promise<void> {
  const { writeFile, exists } = await import("@tauri-apps/plugin-fs")
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener")
  const { downloadDir, join } = await import("@tauri-apps/api/path")

  // A stored name is user-editable, so it can carry separators that would
  // escape the Downloads folder.
  const safe = name.replace(/[/\\]/g, "_").trim() || "attachment"
  const dot = safe.lastIndexOf(".")
  const base = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot) : ""

  const dir = await downloadDir()
  let path = await join(dir, safe)
  for (let n = 1; await exists(path); n++) {
    path = await join(dir, `${base} (${n})${ext}`)
  }

  await writeFile(path, bytes)
  await revealItemInDir(path)
}
