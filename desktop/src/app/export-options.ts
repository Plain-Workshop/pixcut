import type { ExportCodec, ExportContainer } from './bridge';
import type { ShortcutPlatform } from '../shortcuts/registry';

export const EXPORT_QUALITY_CRF: Record<'draft' | 'standard' | 'high', number> = { draft: 28, standard: 23, high: 18 };

export const HINTS_KEY = 'pixcut-hints-dismissed';
export const EXPORT_CODEC_OPTIONS: { id: ExportCodec; label: string; description: string }[] = [
  { id: 'h264', label: 'H.264', description: 'Broad compatibility' },
  { id: 'hevc', label: 'H.265 / HEVC', description: 'Efficient compression' },
  { id: 'vp9', label: 'VP9', description: 'WebM for the web' },
  { id: 'prores', label: 'ProRes 422', description: 'Editing master' },
];
export const EXPORT_CONTAINERS: Record<ExportCodec, ExportContainer[]> = {
  h264: ['mp4', 'mov', 'mkv'],
  hevc: ['mp4', 'mov', 'mkv'],
  vp9: ['webm'],
  prores: ['mov'],
};
export const EXPORT_CONTAINER_LABEL: Record<ExportContainer, string> = {
  mp4: 'MP4 (.mp4)', mov: 'QuickTime (.mov)', mkv: 'Matroska (.mkv)', webm: 'WebM (.webm)',
};
export const EXPORT_CONTAINER_SHORT: Record<ExportContainer, string> = { mp4: 'MP4', mov: 'MOV', mkv: 'MKV', webm: 'WEBM' };
export const EXPORT_CODEC_NOTE: Record<ExportCodec, string> = {
  h264: 'H.264 is the default for sharing and everyday playback.',
  hevc: 'H.265 playback needs a player or device that supports HEVC.',
  vp9: 'VP9 in WebM plays in browsers and most modern players.',
  prores: 'ProRes 422 is a large editing master; quality picks LT, 422 or HQ.',
};
export const FFMPEG_INSTALL: Record<ShortcutPlatform, string> = { macos: 'brew install ffmpeg', windows: 'winget install Gyan.FFmpeg', linux: 'sudo apt install ffmpeg' };

export const EXPORT_CODEC_CRF: Record<ExportCodec, Record<'draft' | 'standard' | 'high', number>> = {
  h264: EXPORT_QUALITY_CRF,
  hevc: { draft: 30, standard: 26, high: 20 },
  vp9: { draft: 35, standard: 32, high: 28 },
  prores: { draft: 30, standard: 24, high: 18 },
};
