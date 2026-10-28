import { t } from '../i18n';
import { resolveMediaSource } from '../components/preview/media-url';
import { MAX_AUDIO_FILE_BYTES } from '../stores/model';
import type { ProjectSummary } from '../stores/library';
import { isImageFile } from './errors';

export function sortProjects(items: ProjectSummary[]) {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return t('just now');
  if (seconds < 3600) return t('{count} min ago', { count: Math.floor(seconds / 60) });
  if (seconds < 86_400) return t('{count} h ago', { count: Math.floor(seconds / 3600) });
  if (seconds < 604_800) return t('{count} d ago', { count: Math.floor(seconds / 86_400) });
  return new Date(timestamp).toLocaleDateString();
}

export function imageFileData(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error(`“${file.name}” is not a JPEG, PNG, or WebP image. Choose one of those formats.`));
  }
  if (file.size > 500 * 1024 * 1024) {
    return Promise.reject(new Error(`“${file.name}” is larger than 500 MB. Choose a smaller image.`));
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function audioMime(file: File) {
  const type = file.type.toLowerCase();
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'audio/mpeg';
  if (type === 'audio/wav' || type === 'audio/x-wav') return 'audio/wav';
  if (type === 'audio/mp4' || type === 'audio/x-m4a') return 'audio/mp4';
  if (type === 'audio/aac') return 'audio/aac';
  if (type === 'audio/ogg') return 'audio/ogg';
  if (type === 'audio/webm') return 'audio/webm';
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'ogg' || extension === 'oga') return 'audio/ogg';
  if (extension === 'webm') return 'audio/webm';
  return '';
}


export async function audioFileData(file: File) {
  const mime = audioMime(file);
  if (!mime) {
    if (isImageFile(file)) throw new Error(`“${file.name}” is an image, not audio. Choose an MP3, WAV, M4A, OGG, or WebM audio file.`);
    throw new Error(`“${file.name}” is not a supported audio file. Choose MP3, WAV, M4A, OGG, or WebM.`);
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) throw new Error(`“${file.name}” is larger than 50 MB. Choose a shorter or smaller audio file.`);
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`“${file.name}” could not be read. Try choosing it again.`));
    reader.readAsDataURL(file);
  });
  return `data:${mime};base64,${raw.slice(raw.indexOf(',') + 1)}`;
}

export async function audioDuration(data: string) {
  const source = await resolveMediaSource(data);
  if (!source) return 0;
  return new Promise<number>(resolve => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => resolve(0);
    audio.src = source;
  });
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function previewClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}


export function mediaSource(value: string | undefined) {
  return value && !value.startsWith('pixcut-asset:') ? value : undefined;
}
/** True when a source is a data URL or a streamed asset reference. */
export function hasMedia(value: string | undefined) {
  return Boolean(value) && (value!.startsWith('pixcut-asset:') || Boolean(mediaSource(value)));
}
