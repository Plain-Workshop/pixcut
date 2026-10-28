import { describe, expect, it } from 'vitest';
import { resolvePreviewTarget } from '../src/components/preview/preview-target';

const a = { id: 'a' };
const b = { id: 'b' };

describe('resolvePreviewTarget', () => {
  it('shows the active scene when nothing is pinned', () => {
    expect(resolvePreviewTarget(false, a, null)).toBe(a);
    expect(resolvePreviewTarget(true, a, null)).toBe(a);
  });

  it('keeps a pinned draft visible while paused', () => {
    expect(resolvePreviewTarget(false, a, b)).toBe(b);
  });

  it('ignores a pinned draft during playback so the video follows the playhead', () => {
    expect(resolvePreviewTarget(true, a, b)).toBe(a);
  });

  it('has nothing to draw without an active scene', () => {
    expect(resolvePreviewTarget(false, undefined, null)).toBeUndefined();
    expect(resolvePreviewTarget(true, undefined, b)).toBeUndefined();
  });
});
