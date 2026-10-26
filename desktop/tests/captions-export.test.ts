import { describe, expect, it } from 'vitest';
import { srtTimestamp, textLayersAsCaptions, toSrt } from '../src/components/text/captions-export';
import { DEFAULT_TIMEBASE, secondsToTicks, type Scene, type TextLayer } from '../src/stores/model';

const layer = (id: string, title: string, startSeconds: number, durationSeconds: number, subtitle = ''): TextLayer => ({
  id, title, subtitle, startTicks: secondsToTicks(startSeconds, DEFAULT_TIMEBASE), durationTicks: secondsToTicks(durationSeconds, DEFAULT_TIMEBASE),
  color: '#FFFFFF', x: .1, y: .8, width: .8, align: 'center', font: 'inter', fontWeight: 600, fontStyle: 'normal', size: .05,
  lineHeight: 1.2, letterSpacing: 0, rotation: 0, opacity: 100, subtitleScale: .4, backdropEnabled: false, backdropColor: '#000000',
  backdropOpacity: 45, backdropBlur: 18, backdropPadding: 24, backdropRadius: 16, backdropNoise: 8, outlineEnabled: false,
  strokeColor: '#000000', strokeWidth: 0, shadowEnabled: false, shadowColor: '#000000', shadowIntensity: 60, shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, glowEnabled: false, glowColor: '#ffffff', glowBlur: 24, glowIntensity: 55,
  animation: 'none', animationDuration: .5,
});

const scene = (id: string, startSeconds: number, durationSeconds: number, layers: TextLayer[]): Scene => ({
  id, name: id, image: 'data:image/png;base64,AA==', startTicks: secondsToTicks(startSeconds, DEFAULT_TIMEBASE),
  sourceInTicks: 0, durationTicks: secondsToTicks(durationSeconds, DEFAULT_TIMEBASE),
  title: '', subtitle: '', textLayers: layers, color: '#FFFFFF', fit: 'cover',
});

describe('textLayersAsCaptions', () => {
  it('places layers at their absolute timeline time across scenes', () => {
    const captions = textLayersAsCaptions([
      scene('one', 0, 2, [layer('a', 'First', .5, 1)]),
      scene('two', 2, 2, [layer('b', 'Second', 0, 1.5)]),
    ], DEFAULT_TIMEBASE);
    expect(captions.map(caption => caption.text)).toEqual(['First', 'Second']);
    expect(captions[0]).toMatchObject({ start: .5, end: 1.5 });
    expect(captions[1].start).toBe(2);
    expect(captions[1].end).toBe(3.5);
  });

  it('keeps the subtitle on its own line and skips empty layers', () => {
    const captions = textLayersAsCaptions([scene('one', 0, 3, [layer('a', 'Title', 0, 2, 'Subtitle'), layer('b', '   ', 0, 1)])], DEFAULT_TIMEBASE);
    expect(captions).toHaveLength(1);
    expect(captions[0].text).toBe('Title\nSubtitle');
  });

  it('sorts cues and never emits a broken range', () => {
    const captions = textLayersAsCaptions([scene('one', 0, 4, [layer('late', 'Late', 2, 1), layer('early', 'Early', .5, .5)])], DEFAULT_TIMEBASE);
    expect(captions.map(caption => caption.text)).toEqual(['Early', 'Late']);
  });
});

describe('SRT output', () => {
  it('formats hours, minutes, seconds and milliseconds', () => {
    expect(srtTimestamp(0)).toBe('00:00:00,000');
    expect(srtTimestamp(65.25)).toBe('00:01:05,250');
    expect(srtTimestamp(3725.5)).toBe('01:02:05,500');
    expect(srtTimestamp(-1)).toBe('00:00:00,000');
    expect(srtTimestamp(Number.NaN)).toBe('00:00:00,000');
  });

  it('numbers cues with blank lines and a trailing newline', () => {
    const srt = toSrt([
      { start: .5, end: 1.25, text: 'First line' },
      { start: 2, end: 3, text: 'Second\nline' },
    ]);
    expect(srt).toBe('1\n00:00:00,500 --> 00:00:01,250\nFirst line\n\n2\n00:00:02,000 --> 00:00:03,000\nSecond\nline\n');
  });
});
