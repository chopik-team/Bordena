import { beforeEach, describe, expect, it } from "vitest"
import { Vault } from "../src/vault"
import { FakeBoard, makeCard, makeColumn, MemoryFs } from "./fakes"

const ROOT = "/vault"
const BOARD = "board-1"
const TODO = makeColumn("col-todo", "To do")
const DONE = makeColumn("col-done", "Done")

describe("column folders", () => {
  let fs: MemoryFs
  let board: FakeBoard
  let vault: Vault
  let changes: number

  beforeEach(() => {
    fs = new MemoryFs()
    void fs.mkdir(ROOT)
    board = new FakeBoard([TODO, DONE])
    changes = 0
    vault = new Vault({
      fs,
      board,
      boardId: BOARD,
      root: ROOT,
      onBoardChange: () => changes++,
    })
  })

  it("renames the folder when the column is retitled", async () => {
    const card = board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    await vault.sync()

    await board.renameColumn(TODO.id, "Later")
    await vault.sync()

    expect(await fs.readDirs(ROOT)).toContain("later")
    expect(fs.files.has(`${ROOT}/to_do/ship_it.md`)).toBe(false)
    expect(fs.files.get(`${ROOT}/later/ship_it.md`)).toContain(`id: ${card.id}`)
    expect(board.cardsById.has(card.id)).toBe(true)
    expect(changes).toBe(0)
  })

  it("renames the column when the folder is renamed", async () => {
    const card = board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    await vault.sync()

    await fs.rename(`${ROOT}/to_do`, `${ROOT}/Later`)
    await vault.sync()

    expect(board.column(TODO.id)?.title).toBe("Later")
    expect(fs.files.has(`${ROOT}/Later/ship_it.md`)).toBe(true)
    expect(board.cardsById.get(card.id)?.columnId).toBe(TODO.id)
    expect(changes).toBe(1)
  })

  it("reads a snake_case folder name back as a display title", async () => {
    board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    await vault.sync()

    await fs.rename(`${ROOT}/to_do`, `${ROOT}/in_progress`)
    await vault.sync()

    expect(board.column(TODO.id)?.title).toBe("In progress")
    expect(await fs.readDirs(ROOT)).toContain("in_progress")
  })

  it("keeps the renamed folder put on the next pass", async () => {
    board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    await vault.sync()
    await fs.rename(`${ROOT}/to_do`, `${ROOT}/Later`)
    await vault.sync()

    changes = 0
    await vault.sync()

    expect(await fs.readDirs(ROOT)).toEqual(
      expect.arrayContaining(["Later", "done"])
    )
    expect(await fs.readDirs(ROOT)).not.toContain("to_do")
    expect(changes).toBe(0)
  })

  it("follows an empty folder someone renamed", async () => {
    board = new FakeBoard([TODO])
    vault = new Vault({ fs, board, boardId: BOARD, root: ROOT })
    await vault.sync()

    await fs.rename(`${ROOT}/to_do`, `${ROOT}/Later`)
    await vault.sync()

    expect(board.column(TODO.id)?.title).toBe("Later")
  })

  it("leaves an ambiguous rename of empty folders alone", async () => {
    await vault.sync()

    await fs.rename(`${ROOT}/to_do`, `${ROOT}/one`)
    await fs.rename(`${ROOT}/done`, `${ROOT}/two`)
    await vault.sync()

    expect(board.column(TODO.id)?.title).toBe("To do")
    expect(board.column(DONE.id)?.title).toBe("Done")
    expect(await fs.readDirs(ROOT)).toContain("to_do")
  })

  it("adopts a folder already named after its column", async () => {
    const card = board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    await vault.sync()

    // A fresh clone: the files are there, the vault remembers nothing.
    fs.files.delete(`${ROOT}/_meta.json`)
    await new Vault({ fs, board, boardId: BOARD, root: ROOT }).sync()

    expect(await fs.readDirs(ROOT)).not.toContain("to_do_2")
    expect(fs.files.get(`${ROOT}/to_do/ship_it.md`)).toContain(`id: ${card.id}`)
  })

  it("gives two columns with one snake name separate folders", async () => {
    const dash = makeColumn("col-dash", "To-do")
    board = new FakeBoard([TODO, dash])
    vault = new Vault({ fs, board, boardId: BOARD, root: ROOT })
    board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    board.add(makeCard({ columnId: dash.id, title: "Ship more" }))
    await vault.sync()

    expect(fs.files.has(`${ROOT}/to_do/ship_it.md`)).toBe(true)
    expect(fs.files.has(`${ROOT}/to_do_2/ship_more.md`)).toBe(true)
  })

  it("ignores its own folders when matching", async () => {
    board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    await vault.sync()

    expect(await fs.readDirs(ROOT)).toEqual(
      expect.arrayContaining(["_trash", "to_do", "done"])
    )
    await fs.rename(`${ROOT}/to_do`, `${ROOT}/Later`)
    await vault.sync()

    expect(board.column(DONE.id)?.title).toBe("Done")
    expect(board.column(TODO.id)?.title).toBe("Later")
  })

  it("does not rename when the title only changes shape", async () => {
    board.add(makeCard({ columnId: TODO.id, title: "Ship it" }))
    await vault.sync()

    await board.renameColumn(TODO.id, "TO DO")
    await vault.sync()

    expect(fs.files.has(`${ROOT}/to_do/ship_it.md`)).toBe(true)
    expect(await fs.readDirs(ROOT)).not.toContain("to_do_2")
  })
})
