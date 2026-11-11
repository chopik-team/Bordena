import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import type { Plugin } from "vite"

/** Collect actual bundled JS packages, plus the two locally bundled font families. */
export function licenseNotices(): Plugin {
  return {
    name: "bordena-license-notices",
    generateBundle() {
      const roots = new Map<
        string,
        { name: string; version: string; license: string; root: string }
      >()
      const include = (file: string) => {
        let dir = path.dirname(file.replace(/\?.*$/, ""))
        while (dir.includes("node_modules")) {
          const manifest = path.join(dir, "package.json")
          if (fs.existsSync(manifest)) {
            const info = JSON.parse(fs.readFileSync(manifest, "utf8"))
            if (info.name && info.version) {
              roots.set(`${info.name}@${info.version}`, {
                name: info.name,
                version: info.version,
                license: info.license ?? "UNKNOWN",
                root: dir,
              })
              return
            }
          }
          const parent = path.dirname(dir)
          if (parent === dir) return
          dir = parent
        }
      }
      for (const id of this.getModuleIds())
        if (id.includes("node_modules") && !id.startsWith("\0")) include(id)
      const require = createRequire(path.resolve("package.json"))
      for (const font of [
        "@fontsource-variable/mulish",
        "@fontsource-variable/geist-mono",
      ])
        include(
          require.resolve(`${font}/package.json`, {
            paths: [path.resolve("apps/client")],
          })
        )
      const packages = [...roots.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      const sections: string[] = [
        `Bordena ${JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version.replace(/\.0$/, "")} — сторонние компоненты\nCopyright сохраняется за авторами перечисленных компонентов.\n`,
      ]
      for (const pkg of packages) {
        const names = fs
          .readdirSync(pkg.root)
          .filter((name) =>
            /^(licen[sc]e|copying|notice|ofl)(\.|$|-)/i.test(name)
          )
        const texts = names
          .filter((name) => fs.statSync(path.join(pkg.root, name)).isFile())
          .map(
            (name) =>
              `${name}\n${fs.readFileSync(path.join(pkg.root, name), "utf8")}`
          )
        sections.push(
          `\n${"=".repeat(60)}\n${pkg.name}@${pkg.version} — ${pkg.license}\n${texts.join("\n\n") || "Сведения о лицензии: " + pkg.license}`
        )
      }
      const evidence = path.resolve("../../docs/evidence")
      fs.mkdirSync(evidence, { recursive: true })
      fs.writeFileSync(
        path.join(evidence, "frontend-packages.json"),
        JSON.stringify(
          packages.map(({ name, version, license }) => ({
            name,
            version,
            license,
          })),
          null,
          2
        )
      )
      const notice = sections.join("\n")
      fs.writeFileSync(
        path.resolve("../../docs/THIRD_PARTY_NOTICES.txt"),
        notice
      )
      this.emitFile({
        type: "asset",
        fileName: "third-party-notices.txt",
        source: notice,
      })
    },
  }
}
