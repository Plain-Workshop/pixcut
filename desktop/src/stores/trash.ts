/** Deleted projects are kept for this many days before they are removed for good. */
export const TRASH_DAYS = 30;
const DAY = 86_400_000;

export function isTrashExpired(deletedAt: number, now = Date.now()): boolean {
  return now - deletedAt >= TRASH_DAYS * DAY;
}

/** Whole days left before a deleted project is removed; never negative. */
export function trashDaysLeft(deletedAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deletedAt + TRASH_DAYS * DAY - now) / DAY));
}
