import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMEBASE, emptyProject, secondsToTicks, type Scene } from '../src/stores/model';
import { beatMarkerTicks, detectBeatsFromSamples, snapScenesToBeats } from '../src/components/timeline/beat-sync';

const RATE = 8000;
const clip = (seconds: number): Scene => ({
  id: `scene-${seconds}`, name: 'Scene', image: 'data:image/png;base64,AA==',
  startTicks: 0, sourceInTicks: 0, durationTicks: secondsToTicks(seconds, DEFAULT_TIMEBASE),
  title: '', subtitle: '', color: '#000000', fit: 'cover',
});

function clickTrack(bpm = 120, seconds = 5) {
  const samples = new Float32Array(RATE * seconds);
  const interval = 60 / bpm;
  for (let beat = .5; beat < seconds; beat += interval) {
    const start = Math.round(beat * RATE);
    for (let index = 0; index < Math.round(RATE * .03); index += 1) {
      if (start + index < samples.length) samples[start + index] = Math.sin(index * .7) * Math.exp(-index / 40);
    }
  }
  return samples;
}

describe('beat detection', () => {
  it('finds a steady 120 BPM click track', () => {
    const analysis = detectBeatsFromSamples(clickTrack(), RATE);
    expect(analysis.beats.length).toBeGreaterThanOrEqual(7);
    expect(analysis.bpm).toBeGreaterThanOrEqual(118);
    expect(analysis.bpm).toBeLessThanOrEqual(122);
    expect(analysis.beats[1] - analysis.beats[0]).toBeCloseTo(.5, 1);
  });

  it('returns an empty analysis for silence and for unusable input', () => {
    expect(detectBeatsFromSamples(new Float32Array(RATE), RATE)).toEqual({ beats: [], bpm: 0, confidence: 0 });
    expect(detectBeatsFromSamples(new Float32Array(0), RATE).beats).toEqual([]);
    expect(detectBeatsFromSamples(clickTrack(), 0).beats).toEqual([]);
  });
});

describe('beat markers', () => {
  it('converts source beats to timeline ticks, offsets, clamps and deduplicates', () => {
    expect(beatMarkerTicks([.5, 1, 1.001, 2, 9], secondsToTicks(1, DEFAULT_TIMEBASE), DEFAULT_TIMEBASE, secondsToTicks(5, DEFAULT_TIMEBASE)))
      .toEqual([1.5, 2, 3].map(seconds => secondsToTicks(seconds, DEFAULT_TIMEBASE)));
    expect(beatMarkerTicks([.1, .2], 0, DEFAULT_TIMEBASE, 10, 1)).toHaveLength(1);
  });
});

describe('cut snapping', () => {
  it('moves cuts that are already close to a beat and leaves the final end alone', () => {
    const scenes = [clip(2.3), clip(2.3), clip(2.3), clip(2.3)];
    const result = snapScenesToBeats(scenes, [2.5, 4.5, 6.5, 8.5], 0, DEFAULT_TIMEBASE);
    expect(result.moved).toBe(3);
    expect(result.scenes.map(scene => scene.durationTicks)).toEqual([2.5, 2, 2, 2.3].map(seconds => secondsToTicks(seconds, DEFAULT_TIMEBASE)));
    expect(result.scenes[0].durationTicks).toBe(secondsToTicks(2.5, DEFAULT_TIMEBASE));
  });

  it('ignores beats outside the tolerance and never creates a clip shorter than the floor', () => {
    expect(snapScenesToBeats([clip(2), clip(2)], [2.8], 0, DEFAULT_TIMEBASE).moved).toBe(0);
    expect(snapScenesToBeats([clip(2), clip(2)], [.2], 0, DEFAULT_TIMEBASE).moved).toBe(0);
  });

  it('accounts for where the audio clip starts on the timeline', () => {
    const result = snapScenesToBeats([clip(1.6), clip(2)], [.8], 1, DEFAULT_TIMEBASE);
    expect(result.moved).toBe(1);
    expect(result.scenes[0].durationTicks).toBe(secondsToTicks(1.8, DEFAULT_TIMEBASE));
  });

  it('returns the same order and count for a one-scene story', () => {
    const scenes = [clip(2)];
    const result = snapScenesToBeats(scenes, [2], 0, DEFAULT_TIMEBASE);
    expect(result.moved).toBe(0);
    expect(result.scenes).toEqual(scenes);
    expect(emptyProject().schema_version).toBe(13);
  });
});
