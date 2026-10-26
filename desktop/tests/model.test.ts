import { describe, expect, it } from 'vitest';
import { edit, emptyProject, frameRate, projectScenes, replaceSceneImage, sceneAt, scenePatch, sceneSeconds, secondsToTicks, setSceneSeconds, ticksToSeconds, timecode, totalDuration, trimSceneWindow, validateProject, type AudioClip, type ElementLayer, type Project, type Scene, type TextLayer } from '../src/stores/model';
import { resolveSceneForFormat } from '../src/stores/formats';
const scene = (id: string, duration = 4): Scene => ({ id, startTicks: 0, sourceInTicks: 0, name: 'Photo', image: 'data:image/png;base64,AA==', durationTicks: Math.round(duration * 30), title: '', subtitle: '', color: '#ffffff', fit: 'cover' });
const clips = (project: Project) => projectScenes(project);
describe('project commands and playback', () => {
  it('keeps original snapshots intact and selects the right scene at a cut', () => { const original = emptyProject(); const p = edit(original, { type: 'add', scenes: [scene('a'), scene('b', 2)] }); expect(clips(original)).toHaveLength(0); expect(totalDuration(p)).toBe(6); expect(sceneAt(p, 3.999)?.scene.id).toBe('a'); expect(sceneAt(p, 4)?.scene.id).toBe('b'); });
  it('moves a scene without dropping or duplicating it', () => { const p = edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('b'), scene('c')] }); expect(clips(edit(p, { type: 'move', id: 'b', offset: -1 })).map(s => s.id)).toEqual(['b', 'a', 'c']); expect(edit(p, { type: 'move', id: 'a', offset: -1 })).toEqual(p); });
  it('rejects malformed scenes and unsupported schemas', () => { expect(() => edit(emptyProject(), { type: 'add', scenes: [scene('a', NaN)] })).toThrow(); expect(() => edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('a')] })).toThrow(); expect(() => validateProject({ ...emptyProject(), schema_version: 14 })).toThrow('Unsupported'); });
  it('forces imported projects to remain watermark-free and local', () => { expect(validateProject({ ...emptyProject(), policy: { watermark: true, pixcut_outro: true, privacy: 'cloud' } }).policy).toEqual({ watermark: false, pixcut_outro: false, privacy: 'local' }); });
  it('does not accept remote image references inside project files', () => { expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a'), image: 'https://example.com/private.jpg' }] })).toThrow(); });
  it('splits a scene into two undoable halves at the playhead', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene('a', 4)] });
    const split = edit(p, { type: 'split', id: 'a', atTicks: 45, newId: 'b' });
    expect(clips(split).map(s => [s.id, s.durationTicks])).toEqual([['a', 45], ['b', 75]]);
    expect(totalDuration(split)).toBe(4);
    expect(clips(split)[0].fadeOut).toBe(0);
    expect(clips(split)[1].fadeIn).toBe(0);
    expect(() => edit(p, { type: 'split', id: 'a', atTicks: 6, newId: 'b' })).toThrow(/half a second/);
    expect(() => edit(p, { type: 'split', id: 'a', atTicks: 114, newId: 'b' })).toThrow(/half a second/);
    expect(() => edit(p, { type: 'split', id: 'missing', atTicks: 30, newId: 'b' })).toThrow(/Select a scene/);
    expect(() => edit(p, { type: 'split', id: 'a', atTicks: 30, newId: 'a' })).toThrow(/already exists/);
  });
  it('duplicates a scene immediately after the original', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('b')] });
    const copy = edit(p, { type: 'duplicate', id: 'a', newId: 'a-copy' });
    expect(clips(copy).map(s => s.id)).toEqual(['a', 'a-copy', 'b']);
    expect(clips(copy)[1].name).toBe('Photo copy');
    expect(() => edit(p, { type: 'duplicate', id: 'a', newId: 'b' })).toThrow(/already exists/);
  });
  it('validates color, filter, speed, and fade controls', () => {
    const tuned = { ...scene('a'), brightness: 1.1, contrast: 1.05, saturation: 1.2, exposure: 0.5, highlights: 0.2, shadows: -0.2, temperature: 0.3, tint: -0.1, filter: 'warm' as const, filterIntensity: 60, speed: 2, pitch: true, fadeIn: 1, fadeOut: 1 };
    expect(clips(edit(emptyProject(), { type: 'add', scenes: [tuned] }))[0]).toMatchObject({ filter: 'warm', speed: 2, fadeIn: 1 });
    const invalid: Record<string, unknown>[] = [{ filter: 'vintage' }, { filterIntensity: 101 }, { exposure: 4 }, { speed: 0.1 }, { fadeIn: 5 }, { highlights: 2 }];
    for (const patch of invalid) expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a'), ...patch } as unknown as Scene] })).toThrow();
  });
  it('validates text backdrop, outline, and glow controls', () => {
    const styled = {
      ...scene('a'),
      textBackdropEnabled: true,
      textBackdropColor: '#000000',
      textBackdropOpacity: 45,
      textBackdropBlur: 18,
      textBackdropPadding: 24,
      textBackdropRadius: 16,
      textBackdropNoise: 8,
      textStrokeColor: '#111111',
      textStrokeWidth: 2,
      textOutlineEnabled: true,
      textShadowColor: '#000000',
      textShadowEnabled: true,
      textShadowIntensity: 60,
      textShadowBlur: 12,
      textShadowOffsetX: 0,
      textShadowOffsetY: 2,
      textGlowEnabled: true,
      textGlowColor: '#ffffff',
      textGlowBlur: 28,
      textGlowIntensity: 60,
    };
    expect(clips(edit(emptyProject(), { type: 'add', scenes: [styled] }))[0]).toMatchObject({ textBackdropEnabled: true, textStrokeWidth: 2, textBackdropNoise: 8 });
    const invalid: Record<string, unknown>[] = [
      { textBackdropOpacity: 101 },
      { textBackdropBlur: 61 },
      { textBackdropPadding: 81 },
      { textBackdropRadius: 61 },
      { textBackdropNoise: -1 },
      { textBackdropColor: 'black' },
      { textStrokeWidth: 13 },
      { textStrokeColor: '#fff' },
      { textShadowBlur: 61 },
      { textShadowOffsetX: 41 },
      { textShadowIntensity: -1 },
      { textGlowBlur: 81 },
      { textGlowIntensity: 101 },
      { textGlowColor: 'white' },
      { textOutlineEnabled: 'yes' },
      { textGlowEnabled: 'yes' },
      { textBackdropEnabled: 'yes' },
    ];
    for (const patch of invalid) expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a'), ...patch } as unknown as Scene] })).toThrow();
  });
  it('validates and patches free-positioned text styling', () => {
    const styled = {
      ...scene('a'),
      textX: .2,
      textY: .4,
      textWidth: .6,
      textAlign: 'center' as const,
      textFont: 'playfair',
      textFontWeight: 700,
      textFontStyle: 'italic' as const,
      textSize: .1,
      textLineHeight: 1.4,
      textLetterSpacing: .01,
      textRotation: 12,
      textOpacity: 80,
      textSubtitleScale: .5,
    };
    expect(clips(edit(emptyProject(), { type: 'add', scenes: [styled] }))[0]).toMatchObject({
      textX: .2,
      textY: .4,
      textWidth: .6,
      textAlign: 'center',
      textFont: 'playfair',
      textFontWeight: 700,
      textFontStyle: 'italic',
      textSize: .1,
      textLineHeight: 1.4,
      textLetterSpacing: .01,
      textRotation: 12,
      textOpacity: 80,
      textSubtitleScale: .5,
    });
    expect(scenePatch(scene('a'), styled)).toMatchObject({ textX: .2, textAlign: 'center', textFont: 'playfair', textRotation: 12 });
    const invalid: Record<string, unknown>[] = [
      { textX: 2 }, { textY: -1 }, { textWidth: .01 }, { textAlign: 'justify' }, { textFontWeight: 1000 },
      { textFontStyle: 'oblique' }, { textSize: .9 }, { textLineHeight: .2 }, { textLetterSpacing: .5 },
      { textRotation: 200 }, { textOpacity: 101 }, { textSubtitleScale: .1 },
    ];
    for (const patch of invalid) expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a'), ...patch } as unknown as Scene] })).toThrow();
  });
  it('migrates scene text into independent layers with their own style and timing', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a', 4), title: 'Hello', subtitle: 'There' }] });
    const first = clips(p)[0];
    expect(first.textLayers).toHaveLength(1);
    expect(first.textLayers![0]).toMatchObject({ title: 'Hello', subtitle: 'There', startTicks: 0, durationTicks: 120, font: 'inter' });
    const second: TextLayer = { ...first.textLayers![0], id: 'layer-2', title: 'Second', startTicks: 30, durationTicks: 60, x: .5, size: .1, color: '#ffcc00' };
    const updated = edit(p, { type: 'update', scene: { ...first, textLayers: [...first.textLayers!, second] } });
    expect(clips(updated)[0].textLayers).toHaveLength(2);
    expect(clips(updated)[0].textLayers![1]).toMatchObject({ title: 'Second', startTicks: 30, durationTicks: 60, x: .5, size: .1, color: '#ffcc00' });
    const shortened = edit(updated, { type: 'update', scene: { ...clips(updated)[0], durationTicks: 45 } });
    expect(clips(shortened)[0].textLayers![1]).toMatchObject({ startTicks: 30, durationTicks: 15 });
    const split = edit(updated, { type: 'split', id: 'a', atTicks: 60, newId: 'b' });
    expect(clips(split)[0].textLayers![1]).toMatchObject({ startTicks: 30, durationTicks: 30 });
    expect(clips(split)[1].textLayers![1]).toMatchObject({ startTicks: 0, durationTicks: 30 });
    expect(() => edit(p, { type: 'update', scene: { ...first, textLayers: [{ ...first.textLayers![0], size: .9 }] } })).toThrow(/text/i);
    expect(() => edit(p, { type: 'update', scene: { ...first, textLayers: [{ ...first.textLayers![0], align: 'justify' as TextLayer['align'] }] } })).toThrow(/text/i);
  });
  it('stores per-format framing overrides', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a'), imageX: .1, imageZoom: 1.2 }] });
    const formats = [
      { id: 'yt', name: 'YouTube', platform: 'YouTube', aspect: '16:9', width: 1920, height: 1080, fps: 30, quality: 'standard' as const, presetId: 'youtube-video', overrides: { a: { imageX: -.3, imageZoom: 1.6 } } },
      { id: 'reels', name: 'Reels', platform: 'Instagram', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard' as const, presetId: 'instagram-reels', overrides: { a: { imageX: .4, imageY: .2, imageZoom: 2, fit: 'contain' as const, framingBackground: '#112233' } } },
    ];
    const withFormats = edit(p, { type: 'formats', formats });
    expect(withFormats.formats).toHaveLength(2);
    expect(resolveSceneForFormat(clips(withFormats)[0], withFormats.formats[1])).toMatchObject({ imageX: .4, imageY: .2, imageZoom: 2, fit: 'contain', framingBackground: '#112233' });
    expect(() => edit(p, { type: 'formats', formats: [{ ...formats[0], width: 100 }] })).toThrow(/format/i);
    expect(() => edit(p, { type: 'formats', formats: [{ ...formats[0], overrides: { a: { imageZoom: 8 } } }] })).toThrow(/format/i);
  });
  it('validates image framing controls', () => {
    const framed = { ...scene('a'), imageX: .4, imageY: -.2, imageZoom: 1.8, framingBackground: '#112233', fit: 'contain' as const };
    const p = edit(emptyProject(), { type: 'add', scenes: [framed] });
    expect(clips(p)[0]).toMatchObject({ imageX: .4, imageY: -.2, imageZoom: 1.8, framingBackground: '#112233', fit: 'contain' });
    expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...framed, imageZoom: 8 }] })).toThrow(/text|image|invalid/i);
    expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...framed, imageX: 3 }] })).toThrow(/text|image|invalid/i);
    expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...framed, framingBackground: 'black' }] })).toThrow(/text|image|invalid/i);
  });
  it('validates transitions and text animations', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a', 4), title: 'Hello' }, scene('b', 4)] });
    const first = clips(p)[0];
    const withTransition = edit(p, { type: 'update', scene: { ...first, transition: { type: 'fade', duration: .6 } } });
    expect(clips(withTransition)[0].transition).toEqual({ type: 'fade', duration: .6 });
    const clamped = edit(p, { type: 'update', scene: { ...first, transition: { type: 'zoom', duration: 8 } } });
    expect(clips(clamped)[0].transition).toEqual({ type: 'zoom', duration: 2 });
    expect(() => edit(p, { type: 'update', scene: { ...first, transition: { type: 'bogus' as 'fade', duration: .5 } } })).toThrow(/transition/i);
    const layer = { ...first.textLayers![0], animation: 'slide-up' as const, animationDuration: 1.2 };
    const animated = edit(p, { type: 'update', scene: { ...first, textLayers: [layer] } });
    expect(clips(animated)[0].textLayers![0]).toMatchObject({ animation: 'slide-up', animationDuration: 1.2 });
    expect(() => edit(p, { type: 'update', scene: { ...first, textLayers: [{ ...layer, animation: 'spin' as 'fade' }] } })).toThrow(/animation/i);
  });
  it('clamps fades when splitting a clip', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a', 4), fadeIn: 3, fadeOut: 3.5 }] });
    const split = edit(p, { type: 'split', id: 'a', atTicks: 60, newId: 'b' });
    expect(clips(split)[0]).toMatchObject({ durationTicks: 60, fadeIn: 2, fadeOut: 0 });
    expect(clips(split)[1]).toMatchObject({ durationTicks: 60, fadeIn: 0, fadeOut: 2 });
  });
  it('applies batch updates, removals, and duplicates atomically', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('b'), scene('c')] });
    const updated = edit(p, { type: 'updateMany', scenes: [{ ...clips(p)[0], title: 'A' }, { ...clips(p)[2], title: 'C' }] });
    expect(clips(updated).map(scene => scene.title)).toEqual(['A', '', 'C']);
    const removed = edit(updated, { type: 'removeMany', ids: ['a', 'c'] });
    expect(clips(removed).map(scene => scene.id)).toEqual(['b']);
    const duplicated = edit(p, { type: 'duplicateMany', items: [{ id: 'a', newId: 'a2' }, { id: 'c', newId: 'c2' }] });
    expect(clips(duplicated).map(scene => scene.id)).toEqual(['a', 'a2', 'b', 'c', 'c2']);
    expect(clips(duplicated).filter(scene => scene.name.endsWith('copy'))).toHaveLength(2);
  });
  it('derives minimal scene patches and treats defaults as equal', () => {
    const base = scene('a');
    expect(scenePatch(base, { ...base })).toEqual({});
    expect(scenePatch(base, { ...base, brightness: 1, filterIntensity: 100, pitch: true })).toEqual({});
    expect(scenePatch(base, { ...base, title: 'New', filter: 'warm', speed: 2 })).toEqual({ title: 'New', filter: 'warm', speed: 2 });
  });
  it('uses a rational 1/30 timebase for frame-exact boundaries', () => {
    const project = emptyProject();
    clips(project).push(scene('a', 4));
    expect(project.timebase).toEqual({ numerator: 1, denominator: 30 });
    expect(secondsToTicks(1.5)).toBe(45);
    expect(ticksToSeconds(45)).toBeCloseTo(1.5);
    expect(setSceneSeconds(clips(project)[0], 3.3).durationTicks).toBe(99);
    expect(sceneSeconds(clips(project)[0])).toBeCloseTo(4);
    expect(totalDuration(project)).toBeCloseTo(4);
    expect(timecode(1.5)).toBe('00:01:15');
  });
  it('migrates legacy second-based projects to integer frame ticks', () => {
    const legacyScene = { ...scene('a') } as Record<string, unknown>;
    delete legacyScene.durationTicks;
    legacyScene.duration = 4;
    const legacy = { ...emptyProject(), schema_version: 1, timebase: undefined, scenes: [legacyScene] };
    const migrated = validateProject(legacy);
    expect(migrated.schema_version).toBe(13);
    expect(migrated.tracks).toHaveLength(1);
    expect(migrated.tracks[0].kind).toBe('visual');
    expect(migrated.timebase).toEqual({ numerator: 1, denominator: 30 });
    expect(clips(migrated)[0].durationTicks).toBe(120);
    expect(clips(migrated)[0].startTicks).toBe(0);
    expect('duration' in clips(migrated)[0]).toBe(false);
  });
  it('validates multiple local audio clips with trims', () => {
    const base = edit(emptyProject(), { type: 'add', scenes: [scene('a', 4)] });
    const clip: AudioClip = { id: 'audio-1', name: 'Track.mp3', data: 'data:audio/mpeg;base64,AA==', lane: 0, startTicks: 0, durationTicks: 60, sourceInSeconds: 0, sourceDurationSeconds: 2, volume: 0.8, fadeIn: 0.5, fadeOut: 0.5 };
    const second: AudioClip = { ...clip, id: 'audio-2', startTicks: 60, durationTicks: 60, sourceInSeconds: 1, sourceDurationSeconds: 3 };
    const project = { ...base, audio: [clip, second] };
    const validated = validateProject(project);
    expect(validated.audio).toEqual([clip, second]);
    const withAudio = edit(base, { type: 'audio', audio: [clip] });
    expect(withAudio.audio).toEqual([clip]);
    expect(edit(withAudio, { type: 'audio', audio: [] }).audio).toEqual([]);
    expect(edit(withAudio, { type: 'remove', id: 'a' }).audio).toEqual([]);
    expect(() => validateProject({ ...project, audio: [{ ...clip, volume: 2 }] })).toThrow(/audio/i);
    expect(() => validateProject({ ...project, audio: [{ ...clip, fadeIn: 31 }] })).toThrow(/audio/i);
    expect(() => validateProject({ ...project, audio: [{ ...clip, data: 'data:audio/xyz;base64,AA==' }] })).toThrow(/audio/i);
    expect(() => validateProject({ ...project, audio: [{ ...clip, durationTicks: 200 }] })).toThrow(/audio/i);
    expect(() => validateProject({ ...project, audio: [{ ...clip, sourceInSeconds: 1.5, durationTicks: 60 }] })).toThrow(/trim/i);
    expect(() => validateProject({ ...project, audio: [clip, clip] })).toThrow(/Duplicate/i);
    const elementProject = edit(emptyProject(), { type: 'add', scenes: [scene('elements')] });
    const elementClip = elementProject.tracks[0].clips[0];
    const element: ElementLayer = { id: 'el', kind: 'star', x: .5, y: .5, width: .3, height: .3, rotation: 0, color: '#9D7CFF', opacity: 100, startTicks: 0, durationTicks: elementClip.durationTicks, animation: 'none' };
    const withElement = validateProject({ ...elementProject, tracks: [{ ...elementProject.tracks[0], clips: [{ ...elementClip, elements: [element] }] }] });
    expect(withElement.tracks[0].clips[0].elements?.[0].kind).toBe('star');
    const splitElements = edit(withElement, { type: 'split', id: elementClip.id, atTicks: Math.floor(elementClip.durationTicks / 2), newId: 'el-split' });
    expect(splitElements.tracks[0].clips).toHaveLength(2);
    expect(splitElements.tracks[0].clips[0].elements?.[0].durationTicks).toBeLessThanOrEqual(splitElements.tracks[0].clips[0].durationTicks);
    expect(() => validateProject({ ...withElement, tracks: [{ ...withElement.tracks[0], clips: [{ ...withElement.tracks[0].clips[0], elements: [{ ...element, kind: 'bogus' as 'star' }] }] }] })).toThrow(/element/i);
    const videoProject = edit(emptyProject(), { type: 'add', scenes: [scene('video')] });
    const videoClip = videoProject.tracks[0].clips[0];
    const video = { ...videoClip, image: 'data:video/mp4;base64,AAAA', mediaKind: 'video' as const, videoPoster: 'data:image/jpeg;base64,AAAA' };
    expect(validateProject({ ...videoProject, tracks: [{ ...videoProject.tracks[0], clips: [video] }] }).tracks[0].clips[0].mediaKind).toBe('video');
    expect(() => validateProject({ ...videoProject, tracks: [{ ...videoProject.tracks[0], clips: [{ ...video, image: 'data:image/png;base64,AAAA' }] }] })).toThrow(/invalid/i);
    expect(emptyProject('Film', '16:9', 24).timebase).toEqual({ numerator: 1, denominator: 24 });
    expect(frameRate(emptyProject('Smooth', '16:9', 60).timebase)).toBe(60);
    expect(emptyProject('Fallback', '16:9', 47).timebase).toEqual({ numerator: 1, denominator: 30 });
    const legacyClip = { ...clip } as Partial<AudioClip>;
    delete legacyClip.lane;
    expect(validateProject({ ...project, audio: [legacyClip as AudioClip] }).audio[0].lane).toBe(0);
    const large = { ...clip, data: `data:audio/mpeg;base64,${'A'.repeat(9_000_000)}` };
    expect(validateProject({ ...project, audio: [large] }).audio[0].data.length).toBeGreaterThan(8_000_000);
  });
  it('migrates a legacy single music bed into an audio clip', () => {
    const base = edit(emptyProject(), { type: 'add', scenes: [scene('a', 4)] });
    const migrated = validateProject({ ...base, schema_version: 4, audio: undefined, music: { id: 'music', name: 'Bed.mp3', data: 'data:audio/mpeg;base64,AA==', volume: 0.8, fadeIn: 1, fadeOut: 1, durationSeconds: 2 } });
    expect(migrated.audio).toHaveLength(1);
    expect(migrated.audio[0]).toMatchObject({ id: 'music', startTicks: 0, durationTicks: 60, sourceInSeconds: 0, sourceDurationSeconds: 2, volume: 0.8 });
  });
  it('wraps schema v2 scenes into a visual track', () => {
    const v2 = { ...emptyProject(), schema_version: 2, tracks: undefined, scenes: [scene('a'), scene('b', 2)] };
    const migrated = validateProject(v2);
    expect(migrated.schema_version).toBe(13);
    expect(migrated.tracks).toHaveLength(1);
    expect(clips(migrated).map(clip => [clip.id, clip.startTicks, clip.durationTicks])).toEqual([['a', 0, 120], ['b', 120, 60]]);
  });
  it('replaces a scene image while keeping timing, text, and looks', () => {
    const original = {
      ...scene('a', 6.5),
      title: 'Keep this title',
      subtitle: 'And this subtitle',
      name: 'Old photo.jpg',
      filter: 'warm' as const,
      filterIntensity: 65,
      speed: 1.5,
      fadeIn: 0.8,
      fadeOut: 1.2,
      textBackdropEnabled: true,
      textBackdropColor: '#000000',
      textBackdropOpacity: 40,
      textGlowEnabled: true,
      textGlowColor: '#9B7CFF',
      textGlowBlur: 28,
      textGlowIntensity: 60,
    };
    const next = replaceSceneImage(original, 'data:image/png;base64,BBBB', 'New photo.png');
    expect(next).toMatchObject({
      id: 'a',
      name: 'New photo.png',
      image: 'data:image/png;base64,BBBB',
      durationTicks: 195,
      title: 'Keep this title',
      subtitle: 'And this subtitle',
      filter: 'warm',
      filterIntensity: 65,
      speed: 1.5,
      fadeIn: 0.8,
      fadeOut: 1.2,
      textBackdropEnabled: true,
      textBackdropOpacity: 40,
      textGlowEnabled: true,
      textGlowBlur: 28,
    });
    expect(replaceSceneImage(original, 'data:image/png;base64,BBBB', '   ').name).toBe('Old photo.jpg');
  });
});

describe('ripple scene trimming', () => {
  const video = (patch: Partial<Scene> = {}): Scene => ({ ...scene('v'), mediaKind: 'video', image: 'data:video/mp4;base64,AA==', sourceDurationSeconds: 5, ...patch });
  const tb = emptyProject().timebase;

  it('trims a photo from the right and clamps to the 0.5–30 s window', () => {
    const short = trimSceneWindow(scene('a'), -900, 'right', tb);
    expect(short.durationTicks).toBe(15);
    const long = trimSceneWindow(scene('a'), 900, 'right', tb);
    expect(long.durationTicks).toBe(900);
    expect(short.sourceInTicks).toBe(0);
  });

  it('keeps video trims inside the available source', () => {
    const trimmed = trimSceneWindow(video({ startTicks: 0, sourceInTicks: 30, sourceDurationSeconds: 5, speed: 2 }), 300, 'right', tb);
    expect(trimmed.durationTicks).toBe(60);
    const inward = trimSceneWindow(video({ sourceInTicks: 30, sourceDurationSeconds: 5 }), 15, 'left', tb);
    expect(inward.sourceInTicks).toBe(45);
    expect(inward.durationTicks).toBe(105);
    const outward = trimSceneWindow(video({ sourceInTicks: 30, sourceDurationSeconds: 5 }), -60, 'left', tb);
    expect(outward.sourceInTicks).toBe(0);
    expect(outward.durationTicks).toBe(150);
    expect(outward.fadeIn).toBe(0);
  });

  it('treats a legacy video without a stored source length as fixed at its current end', () => {
    const legacy = video({ sourceDurationSeconds: undefined, speed: 1.5, sourceInTicks: 30 });
    const extended = trimSceneWindow(legacy, 600, 'right', tb);
    expect(extended.durationTicks).toBe(120);
    const inward = trimSceneWindow(legacy, -30, 'right', tb);
    expect(inward.durationTicks).toBe(90);
  });

  it('clamps fades to the trimmed duration', () => {
    const trimmed = trimSceneWindow({ ...scene('a'), fadeIn: 1, fadeOut: 1 }, -105, 'right', tb);
    expect(trimmed.durationTicks).toBe(15);
    expect(trimmed.fadeIn).toBe(.5);
    expect(trimmed.fadeOut).toBe(.5);
  });
});

describe('native project compatibility', () => {
  it('opens native formats with a null optional preset and cached video sources', () => {
    const project = edit(emptyProject(), { type: 'add', scenes: [{ ...scene('native'), mediaKind: 'video', image: `pixcut-asset:${'a'.repeat(64)}` }] });
    const native = JSON.parse(JSON.stringify(project)); native.formats[0].presetId = null;
    native.formats[0].overrides = { native: { imageX: null, imageY: null, imageZoom: 1.6, fit: null, framingBackground: null } };
    expect(validateProject(native).formats[0].overrides.native).toEqual({ imageZoom: 1.6 });
    expect(validateProject(native).formats[0].presetId).toBeUndefined();
    expect(projectScenes(validateProject(native))[0].mediaKind).toBe('video');
  });
});
