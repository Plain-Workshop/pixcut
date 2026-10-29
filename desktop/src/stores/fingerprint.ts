import type { Project } from './model';

/**
 * A short hash of what a project looks like, ignoring how its media is held.
 * Hydrated projects carry data URLs while saved ones carry asset references, so
 * anything that stands in for media bytes is reduced to a marker. Two copies of
 * the same edit then hash the same, and any real change moves the hash.
 */
export function projectFingerprint(project: Project): string {
  const text = JSON.stringify(project, (_key, value) => {
    if (typeof value !== 'string') return value;
    if (value.startsWith('data:') || value.startsWith('pixcut-asset:') || value.startsWith('blob:') || value.length > 400) return '<media>';
    return value;
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length.toString(36)}-${hash.toString(36)}`;
}
