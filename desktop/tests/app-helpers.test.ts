import { describe, expect, it } from 'vitest';
import { audioMime, formatBytes, hasMedia, mediaSource, previewClock, sortProjects } from '../src/app/helpers';

describe('app helpers', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(10)).toBe('1 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });
  it('formats the preview clock and rejects bad input', () => {
    expect(previewClock(65.9)).toBe('1:05');
    expect(previewClock(NaN)).toBe('0:00');
    expect(previewClock(-1)).toBe('0:00');
  });
  it('detects audio types by MIME then extension', () => {
    expect(audioMime(new File([], 'a.bin', { type: 'audio/x-m4a' }))).toBe('audio/mp4');
    expect(audioMime(new File([], 'song.MP3'))).toBe('audio/mpeg');
    expect(audioMime(new File([], 'photo.png', { type: 'image/png' }))).toBe('');
  });
  it('treats asset references as media but not as a direct source', () => {
    expect(mediaSource('pixcut-asset:abc')).toBeUndefined();
    expect(mediaSource('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    expect(hasMedia('pixcut-asset:abc')).toBe(true);
    expect(hasMedia(undefined)).toBe(false);
  });
  it('sorts projects newest first without mutating the input', () => {
    const input = [{ updatedAt: 1 }, { updatedAt: 3 }] as never[];
    expect(sortProjects(input).map(p => (p as { updatedAt: number }).updatedAt)).toEqual([3, 1]);
    expect((input[0] as { updatedAt: number }).updatedAt).toBe(1);
  });
});

describe('credits file', () => {
  it('lists each credit once and names the project', async () => {
    const { creditsFileText } = await import('../src/app/helpers');
    const text = creditsFileText(' My Story ', ['“A” by X – CC BY 4.0', ' “A” by X – CC BY 4.0 ', '', '“B” by Y – CC0']);
    expect(text).toContain('Music credits for “My Story”');
    expect(text.match(/“A” by X/g)).toHaveLength(1);
    expect(text).toContain('“B” by Y – CC0');
    expect(creditsFileText('', ['x'])).toContain('“Untitled”');
  });
});
