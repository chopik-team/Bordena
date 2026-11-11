/**
 * How long a tombstoned record stays restorable from the trash. Past it, both
 * ends hard-delete it independently — the client on its retention sweep, the
 * server on its purge job — so neither has to tell the other it happened.
 */
export const RETENTION_MS = 14 * 24 * 60 * 60 * 1000
