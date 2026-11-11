import { orpc } from "./sync/orpc"

/**
 * The board's public link. Separate from `members`: that shares with accounts on
 * this deploy, this shares with anyone holding the link, read-only and with no
 * sign-in. Publishing is owner-only server-side; reading the status is not.
 *
 * The token is not on the dashboard record, so it is asked for rather than read
 * off the board the client already has.
 */

export async function publishBoard(boardId: string): Promise<string> {
  const { token } = await orpc.boards.publish({ boardId })
  return token
}

export function unpublishBoard(boardId: string): Promise<void> {
  return orpc.boards.unpublish({ boardId })
}

export async function publicBoardToken(
  boardId: string
): Promise<string | null> {
  const { token } = await orpc.boards.publicStatus({ boardId })
  return token
}

/** Which of the caller's boards are published — the list's marker, no tokens. */
export async function publishedBoards(): Promise<string[]> {
  const { boardIds } = await orpc.boards.published()
  return boardIds
}
