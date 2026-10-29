import type { ProjectSummary } from '../stores/library';

/** Starred projects first; the sort is stable, so recency still orders each group. */
export function homeProjectOrder(projects: ProjectSummary[], limit = 6): ProjectSummary[] {
  return [...projects].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))).slice(0, limit);
}

/** The most recently edited project, or null for an empty library. */
export function resumeProject(projects: ProjectSummary[]): ProjectSummary | null {
  return projects.length ? projects.reduce((latest, entry) => entry.updatedAt > latest.updatedAt ? entry : latest) : null;
}
