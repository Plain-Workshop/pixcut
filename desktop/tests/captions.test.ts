import { describe, expect, it } from 'vitest';
import { CAPTION_TEXT_LIMIT, parseCaptions, placeCaptions, splitCaptionText } from '../src/components/text/captions';
import { DEFAULT_TIMEBASE, secondsToTicks, type Scene } from '../src/stores/model';

const timebase = DEFAULT_TIMEBASE;

function scene(id: string, seconds: number, startSeconds: number, textLayers?: Scene['textLayers']): Scene {
  return {
    id,
    name: id,
    image: 'data:image/png;base64,AA==',
    startTicks: secondsToTicks(startSeconds, timebase),
    sourceInTicks: 0,
    durationTicks: secondsToTicks(seconds, timebase),
    title: '',
    subtitle: '',
    textLayers,
    color: '#FFFFFF',
    fit: 'cover',
  };
}

describe('parseCaptions', () => {
  it('reads SRT cues with comma milliseconds and multiline text', () => {
    const cues = parseCaptions(`1
00:00:01,000 --> 00:00:03,500
Hello there
second line

2
00:00:04,000 --> 00:00:06,000
<i>Italic</i> &amp; more
`);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3.5, text: 'Hello there second line' });
    expect(cues[1].text).toBe('Italic & more');
  });

  it('reads WebVTT with cue identifiers, dot milliseconds and short timestamps', () => {
    const cues = parseCaptions(`WEBVTT

intro
00:01.500 --> 00:03.000 align:start position:0%
Welcome

00:00:04.250 --> 00:00:05.000
<v Narrator>Bye</v>
`);
    expect(cues.map(cue => cue.text)).toEqual(['Welcome', 'Bye']);
    expect(cues[0]).toMatchObject({ start: 1.5, end: 3 });
    expect(cues[1].start).toBe(4.25);
  });

  it('skips NOTE blocks, empty bodies and inverted timings', () => {
    const cues = parseCaptions(`WEBVTT

NOTE this is a comment

00:00:05.000 --> 00:00:05.000
zero

00:00:07.000 --> 00:00:08.000
kept
`);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('kept');
  });

  it('sorts cues that arrive out of order', () => {
    const cues = parseCaptions(`00:00:05,000 --> 00:00:06,000
later

00:00:01,000 --> 00:00:02,000
earlier`);
    expect(cues.map(cue => cue.text)).toEqual(['earlier', 'later']);
  });

  it('explains what went wrong instead of returning nothing', () => {
    expect(() => parseCaptions('   ')).toThrow(/empty/i);
    expect(() => parseCaptions('not a subtitle file')).toThrow(/No captions were found/i);
  });
});

describe('splitCaptionText', () => {
  it('keeps short cues whole and splits long ones at words', () => {
    expect(splitCaptionText('Short cue')).toEqual(['Short cue']);
    const long = Array.from({ length: 40 }, () => 'word').join(' ');
    const chunks = splitCaptionText(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= CAPTION_TEXT_LIMIT)).toBe(true);
    expect(chunks.join(' ')).toBe(long);
  });

  it('hard-splits a single word longer than the limit', () => {
    const chunks = splitCaptionText('x'.repeat(CAPTION_TEXT_LIMIT * 2 + 5));
    expect(chunks).toHaveLength(3);
    expect(chunks.every(chunk => chunk.length <= CAPTION_TEXT_LIMIT)).toBe(true);
  });
});

describe('placeCaptions', () => {
  it('places cues inside the scene they start in and clips them at the scene end', () => {
    const scenes = [scene('one', 2, 0), scene('two', 3, 2)];
    const { changed, placement } = placeCaptions(scenes, [
      { start: 1.5, end: 3.5, text: 'Crosses the cut' },
      { start: 3, end: 4, text: 'Second scene' },
    ], timebase);
    expect(placement).toMatchObject({ added: 2, skipped: 0, scenes: 2 });
    const first = changed.find(item => item.id === 'one')!;
    expect(first.textLayers).toHaveLength(1);
    expect(first.textLayers![0]).toMatchObject({ title: 'Crosses the cut', startTicks: secondsToTicks(1.5, timebase) });
    expect(first.textLayers![0].durationTicks).toBe(first.durationTicks - secondsToTicks(1.5, timebase));
    expect(changed.find(item => item.id === 'two')!.textLayers![0]).toMatchObject({ startTicks: secondsToTicks(1, timebase) });
  });

  it('keeps existing layers and starts captions after them', () => {
    const existing = [{ ...scene('one', 3, 0).textLayers, id: 'title', title: 'Title', subtitle: '', startTicks: 0, durationTicks: 90 } as NonNullable<Scene['textLayers']>[number]];
    const { changed, placement } = placeCaptions([scene('one', 3, 0, existing)], [{ start: 1, end: 2, text: 'Caption' }], timebase);
    expect(placement.added).toBe(1);
    const layers = changed[0].textLayers!;
    expect(layers.map(layer => layer.title)).toEqual(['Title', 'Caption']);
  });

  it('skips captions outside the timeline or when a scene already has eight layers', () => {
    const busy = Array.from({ length: 8 }, (_, index) => ({
      ...scene('one', 3, 0).textLayers, id: `layer-${index}`, title: `Layer ${index}`,
      subtitle: '', startTicks: 0, durationTicks: 30, color: '#FFFFFF', x: .1, y: .1, width: .8,
      align: 'left' as const, font: 'inter', fontWeight: 600, fontStyle: 'normal' as const, size: .05,
      lineHeight: 1.2, letterSpacing: 0, rotation: 0, opacity: 100, subtitleScale: .4,
      backdropEnabled: false, backdropColor: '#000000', backdropOpacity: 45, backdropBlur: 18,
      backdropPadding: 24, backdropRadius: 16, backdropNoise: 8, outlineEnabled: false,
      strokeColor: '#000000', strokeWidth: 0, shadowEnabled: false, shadowColor: '#000000',
      shadowIntensity: 60, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, glowEnabled: false,
      glowColor: '#FFFFFF', glowBlur: 24, glowIntensity: 55, animation: 'none' as const, animationDuration: .5,
    }));
    const { changed, placement } = placeCaptions([scene('one', 3, 0, busy)], [
      { start: 1, end: 2, text: 'No room' },
      { start: 9, end: 10, text: 'Outside' },
    ], timebase);
    expect(placement.skipped).toBe(2);
    expect(changed).toHaveLength(0);
  });

  it('splits a long cue and gives every piece a share of the time', () => {
    const long = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    const { changed, placement } = placeCaptions([scene('one', 10, 0)], [{ start: 1, end: 9, text: long }], timebase);
    expect(placement.split).toBe(1);
    const layers = changed[0].textLayers!;
    expect(layers.length).toBeGreaterThan(1);
    expect(layers.every(layer => layer.durationTicks >= 1)).toBe(true);
    expect(layers.at(-1)!.startTicks + layers.at(-1)!.durationTicks).toBe(secondsToTicks(9, timebase));
  });

  it('styles captions as readable text layers', () => {
    const { changed } = placeCaptions([scene('one', 5, 0)], [{ start: 1, end: 2, text: 'Readable' }], timebase);
    expect(changed[0].textLayers![0]).toMatchObject({ align: 'center', backdropEnabled: true, animation: 'fade' });
    expect(changed[0].textLayers![0].y).toBeGreaterThan(.6);
  });
});
