import type { ProjectSummary } from '../stores/library';

/** Starred projects first; the sort is stable, so recency still orders each group. */
export function homeProjectOrder(projects: ProjectSummary[], limit = 6): ProjectSummary[] {
  return [...projects].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))).slice(0, limit);
}

/** The most recently edited project, or null for an empty library. */
export function resumeProject(projects: ProjectSummary[]): ProjectSummary | null {
  return projects.length ? projects.reduce((latest, entry) => entry.updatedAt > latest.updatedAt ? entry : latest) : null;
}

export type DateBucket = 'Today' | 'Yesterday' | 'This week' | 'This month' | 'Earlier';
export const DATE_BUCKETS: DateBucket[] = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];

/** Which "edited when" heading a project belongs under, using local calendar days. */
export function dateBucket(updatedAt: number, now = Date.now()): DateBucket {
  const startOfDay = (value: number) => { const day = new Date(value); day.setHours(0, 0, 0, 0); return day.getTime(); };
  const days = Math.round((startOfDay(now) - startOfDay(updatedAt)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  if (days < 31) return 'This month';
  return 'Earlier';
}
