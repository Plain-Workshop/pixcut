import { ticksToSeconds, type Project, type AudioClip } from '../../stores/model';
import { timelineOverlays } from './overlays';
const sounds = new Map<string, string>();
// Locally synthesized PCM bell. No downloads, external services or autoplay context.
export function bellSound(seconds: number, repeat: boolean): string {
  const length = Math.max(.05, Math.min(30, seconds)), key = `${length.toFixed(3)}-${repeat}`;
  if (sounds.has(key)) return sounds.get(key)!;
  const rate = 22050, count = Math.ceil(rate * length), bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
  const word = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const time = i / rate, t = repeat ? time % 1.2 : time;
    const signal = (Math.sin(t * 2 * Math.PI * 880) + .45 * Math.sin(t * 2 * Math.PI * 1323) + .2 * Math.sin(t * 2 * Math.PI * 2090)) * Math.exp(-t * 4) * Math.min(1, t * 200) * Math.min(1, (length - time) * 100) * .45;
    view.setInt16(44 + i * 2, Math.round(signal * 32767), true);
  }
  let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const data = `data:audio/wav;base64,${btoa(binary)}`; sounds.set(key, data); if (sounds.size > 20) sounds.delete(sounds.keys().next().value!); return data;
}
export function actionAudio(project: Project): AudioClip[] {
  return timelineOverlays(project).filter(element => element.action?.kind === 'ring' && element.action.sound).flatMap(element => {
    const action = element.action!;
    const cues: AudioClip[] = [];
    const chunkTicks = Math.round(30 * project.timebase.denominator / project.timebase.numerator);
    const total = action.repeat ? action.durationTicks : Math.min(action.durationTicks, Math.round(3 * project.timebase.denominator / project.timebase.numerator));
    for (let offset = 0; offset < total; offset += chunkTicks) {
      const durationTicks = Math.min(chunkTicks, total - offset), seconds = ticksToSeconds(durationTicks, project.timebase);
      cues.push({ id: `cue-${element.id}-${offset}`, name: 'Bell cue', lane: 7, data: bellSound(seconds, action.repeat), startTicks: element.startTicks + action.startTicks + offset, durationTicks, sourceInSeconds: 0, sourceDurationSeconds: seconds, volume: .55, fadeIn: 0, fadeOut: 0 });
    }
    return cues;
  });
}
