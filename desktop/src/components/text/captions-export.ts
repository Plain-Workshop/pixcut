import { ticksToSeconds, type Scene, type Timebase } from '../../stores/model';
import { sceneTextLayers } from './layers';

export type CaptionLine = { start: number; end: number; text: string };

/**
 * Turns every text layer into a subtitle cue at its real timeline position.
 * Titles used as captions travel with the story, so the export needs no extra
 * authoring step; empty layers are skipped.
 */
export function textLayersAsCaptions(scenes: Scene[], timebase: Timebase): CaptionLine[] {
  const lines: CaptionLine[] = [];
  for (const scene of scenes) {
    for (const layer of sceneTextLayers(scene)) {
      const start = ticksToSeconds(scene.startTicks + layer.startTicks, timebase);
      const end = start + ticksToSeconds(layer.durationTicks, timebase);
      const text = [layer.title, layer.subtitle].map(value => value.trim()).filter(Boolean).join('\n');
      if (!text || !(end > start)) continue;
      lines.push({ start, end, text });
    }
  }
  return lines.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** `HH:MM:SS,mmm` as SubRip expects, rounded to the millisecond. */
export function srtTimestamp(seconds: number): string {
  const millis = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds * 1000 : 0));
  const hours = Math.floor(millis / 3_600_000);
  const minutes = Math.floor((millis % 3_600_000) / 60_000);
  const secs = Math.floor((millis % 60_000) / 1000);
  const remainder = millis % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(remainder).padStart(3, '0')}`;
}

/** Serialises cues as a SubRip file with stable numbering and blank separators. */
export function toSrt(captions: CaptionLine[]): string {
  return captions
    .map((caption, index) => `${index + 1}\n${srtTimestamp(caption.start)} --> ${srtTimestamp(caption.end)}\n${caption.text}\n`)
    .join('\n');
}
