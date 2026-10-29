import { playbackPosition } from '../src/components/preview/playback-clock';
import { describe, expect, it, vi } from 'vitest';
import { syncAudioElement } from '../src/components/preview/audio';
import { DEFAULT_TIMEBASE, type AudioClip } from '../src/stores/model';
const clip: AudioClip = { id: 'a', lane: 0, name: 'Tone', data: 'data:audio/wav;base64,AA==', startTicks: 0, durationTicks: 300, sourceInSeconds: 0, sourceDurationSeconds: 10, volume: .8, fadeIn: 0, fadeOut: 0 };
describe('audio playback synchronization', () => {
  it('does not repeatedly play or seek while playback is starting', async () => {
    let finish!: () => void; let time = 0; let seeks = 0;
    const play = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const audio = { paused: true, seeking: false, volume: 1, play, pause: vi.fn(), get currentTime() { return time; }, set currentTime(value: number) { seeks++; time = value; } } as unknown as HTMLAudioElement;
    for (let frame = 0; frame < 120; frame++) syncAudioElement(audio, clip, frame / 30, true, DEFAULT_TIMEBASE);
    expect(play).toHaveBeenCalledTimes(1); expect(seeks).toBe(1);
    finish(); await Promise.resolve(); await Promise.resolve();
  });
  it('lets the media clock run continuously, then pauses at the clip boundary', () => {
    const audio = { paused: false, seeking: false, currentTime: 0, volume: 1, play: vi.fn(), pause: vi.fn() } as unknown as HTMLAudioElement;
    syncAudioElement(audio, clip, 0, true, DEFAULT_TIMEBASE);
    const setter = vi.spyOn(audio, 'play');
    for (let frame = 1; frame < 300; frame++) { audio.currentTime = frame / 30; syncAudioElement(audio, clip, frame / 30, true, DEFAULT_TIMEBASE); expect(audio.currentTime).toBe(frame / 30); }
    expect(setter).not.toHaveBeenCalled();
    syncAudioElement(audio, clip, 10, true, DEFAULT_TIMEBASE); expect(audio.pause).toHaveBeenCalledOnce();
  });
});

it('keeps playback monotonic when UI renders lag or frames are skipped', () => {
  const samples = [0, 16, 33, 600, 1800, 1816, 3600, 7000].map(now => playbackPosition(2, 0, now, 1));
  expect(samples).toEqual([2, 2.016, 2.033, 2.6, 3.8, 3.816, 5.6, 9]);
  expect(playbackPosition(10, 100, 4100, -1)).toBe(6);
});

import { validateProject as validateWithOldKeys, emptyProject as emptyWithOldKeys } from '../src/stores/model';
describe('projects saved by earlier native builds', () => {
  it('still load their snake_case mixer key', () => {
    const raw = { ...emptyWithOldKeys(), audio_mix: { video: 0.5, lanes: [{ lane: 2, volume: 1, muted: true }] } } as unknown as Parameters<typeof validateWithOldKeys>[0];
    const project = validateWithOldKeys(raw);
    expect(project.audioMix).toEqual({ video: 0.5, lanes: [{ lane: 2, volume: 1, muted: true }] });
  });
});
