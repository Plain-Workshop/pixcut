import { describe, expect, it } from 'vitest';
import { isAssetRef, isNativeRuntime, resolveMediaSource } from '../src/components/preview/media-url';

const ref = `pixcut-asset:${'a'.repeat(64)}`;

describe('media source resolution', () => {
  it('recognises streamed asset references', () => {
    expect(isAssetRef(ref)).toBe(true);
    expect(isAssetRef('data:image/png;base64,AA==')).toBe(false);
    expect(isAssetRef(undefined)).toBe(false);
    expect(isAssetRef('')).toBe(false);
  });

  it('passes data and blob URLs straight through', async () => {
    expect(await resolveMediaSource('data:video/mp4;base64,AAAA')).toBe('data:video/mp4;base64,AAAA');
    expect(await resolveMediaSource('blob:https://example/abc')).toBe('blob:https://example/abc');
    expect(await resolveMediaSource(undefined)).toBeUndefined();
  });

  it('returns nothing for a reference outside the native runtime', async () => {
    expect(isNativeRuntime()).toBe(false);
    expect(await resolveMediaSource(ref)).toBeUndefined();
  });
});
