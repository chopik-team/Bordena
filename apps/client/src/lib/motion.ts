/** The board's reorder timing: cards sliding into a new position, and digest
 * rows doing the same when a deadline or a tick regroups them. */
export const REORDER_TRANSITION = {
  duration: 0.22,
  ease: [0.2, 0, 0, 1],
} as const
