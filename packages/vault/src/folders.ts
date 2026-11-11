import type { Card, Column } from "@bordena/contract"
import { cardFiles, claim, ColumnFolder, type VaultFs } from "./column-folder"
import { snakeName, titleOf } from "./utils"
import type { Written } from "./written"

/** `_trash`, `_files` and anything hidden: not a column's folder. */
const OWNED = /^[._]/

interface Named {
  id: string
  title: string
}

/** A column and the folder it lives in, once the two agree on a name. */
export interface Resolved {
  folders: ColumnFolder[]
  /** The columns the board has to rename, because their folders were. */
  retitled: Map<string, string>
  /** The folders of columns the board no longer has, by name under the root. */
  gone: Set<string>
  /** How many columns were made out of folders nobody had claimed. */
  created: number
}

/**
 * The columns as folders, following a rename on either side.
 */
export class Folders {
  private readonly fs: VaultFs
  private readonly root: string
  private readonly written: Written
  private readonly createColumn: (title: string) => Promise<string>

  constructor(
    fs: VaultFs,
    root: string,
    written: Written,
    createColumn: (title: string) => Promise<string>
  ) {
    this.fs = fs
    this.root = root
    this.written = written
    this.createColumn = createColumn
  }

  async resolve(
    columns: Column[],
    cards: Card[],
    dropped: Set<string>
  ): Promise<Resolved> {
    const live = new Set(columns.map((column) => column.id))
    const gone = this.gone(dropped)
    const { chosen, taken, created } = await this.match(columns, cards, gone)

    const folders: ColumnFolder[] = []
    const retitled = new Map<string, string>()

    for (const [column, at] of chosen) {
      const was = this.written.folder(column.id)
      let name = at
      let title = column.title

      if (was && was.name !== name) {
        title = titleOf(name)
        retitled.set(column.id, title)
      } else if (was && was.title !== title) {
        name = await this.rename(at, column, taken)
      }

      this.written.setFolder(column.id, { name, title })
      folders.push(new ColumnFolder(this.fs, column.id, `${this.root}/${name}`))
      live.add(column.id)
    }

    this.written.keepFolders(live)
    return { folders, retitled, gone, created }
  }

  /**
   * The folders whose column the board deleted.
   */
  private gone(dropped: Set<string>): Set<string> {
    const names = new Set<string>()
    for (const [id, folder] of this.written.columnFolders()) {
      if (dropped.has(id)) names.add(folder.name)
    }
    return names
  }

  /**
   * The folder each column lives in, and the folder names already spoken for.
   * Every column comes back with one, whether it was on disk or had to be made
   * up.
   */
  private async match(
    columns: Column[],
    cards: Card[],
    gone: Set<string>
  ): Promise<{
    chosen: Map<Named, string>
    taken: Set<string>
    created: number
  }> {
    const names = (await this.fs.readDirs(this.root)) ?? []
    const free = new Set(
      names.filter((name) => !OWNED.test(name) && !gone.has(name))
    )
    const taken = new Set(names.map((name) => name.toLowerCase()))

    const chosen = new Map<Named, string>()
    const waiting = new Set<Named>(columns)
    const take = (column: Named, name: string) => {
      chosen.set(column, name)
      waiting.delete(column)
      free.delete(name)
    }

    // Still where the vault left it.
    for (const column of columns) {
      const name = this.written.folder(column.id)?.name
      if (name !== undefined && free.has(name)) take(column, name)
    }

    // Renamed on disk: a renamed folder keeps its files, so the ids in them
    // say which column it is.
    const byId = new Map<string, Named>(columns.map((c) => [c.id, c]))
    const owners = new Map(cards.map((card) => [card.id, card.columnId]))
    for (const name of [...free]) {
      const owner = await this.ownerOf(name, owners)
      if (owner === null) continue
      const column = byId.get(owner)
      if (column && waiting.has(column)) take(column, name)
    }

    // An empty folder has nothing inside to go by, but one folder unaccounted
    // for and one column looking for one can only be each other.
    if (waiting.size === 1 && free.size === 1) {
      const [column] = waiting
      const [name] = free
      take(column, name)
    }

    // A new column, or one whose folder is gone. A folder already named after
    // it was mirrored before this vault knew anything: a clone, a reinstall.
    for (const column of [...waiting]) {
      const wanted = snakeName(column.title) || column.id
      take(column, free.has(wanted) ? wanted : claim(wanted, taken))
    }

    let created = 0
    for (const name of [...free]) {
      const title = titleOf(name)
      chosen.set({ id: await this.createColumn(title), title }, name)
      created++
    }

    return { chosen, taken, created }
  }

  /** Moves a folder to match its column's new title, files and all. */
  private async rename(
    from: string,
    column: Named,
    taken: Set<string>
  ): Promise<string> {
    const wanted = snakeName(column.title) || column.id
    // Two titles can snake to one name, and then there is nothing to move.
    if (wanted === from) return from

    const to = claim(wanted, taken)
    await this.fs.rename(`${this.root}/${from}`, `${this.root}/${to}`)
    this.written.reroot(`${this.root}/${from}`, `${this.root}/${to}`)
    return to
  }

  /** Which column the cards in a folder belong to, if any of them says. */
  private async ownerOf(
    folder: string,
    owners: Map<string, string>
  ): Promise<string | null> {
    const path = `${this.root}/${folder}`
    for (const file of (await cardFiles(this.fs, path)) ?? []) {
      const owner = owners.get(file.card.id)
      if (owner) return owner
    }
    return null
  }
}
