import { describe, expect, it } from 'vitest';
import { isTrashExpired, trashDaysLeft, TRASH_DAYS } from '../src/stores/trash';

const DAY = 86_400_000;

describe('recently deleted retention', () => {
  const deletedAt = Date.UTC(2026, 9, 1);
  it('keeps a project for 30 days', () => {
    expect(TRASH_DAYS).toBe(30);
    expect(isTrashExpired(deletedAt, deletedAt + 29 * DAY)).toBe(false);
    expect(isTrashExpired(deletedAt, deletedAt + 30 * DAY)).toBe(true);
  });
  it('counts whole days left and never goes negative', () => {
    expect(trashDaysLeft(deletedAt, deletedAt)).toBe(30);
    expect(trashDaysLeft(deletedAt, deletedAt + 29 * DAY + 1)).toBe(1);
    expect(trashDaysLeft(deletedAt, deletedAt + 90 * DAY)).toBe(0);
  });
});
