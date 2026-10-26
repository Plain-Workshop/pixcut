export function exportEta(elapsedSeconds: number, percent: number): string {
  if (percent < 3 || elapsedSeconds < 2) return 'Estimating remaining time…';
  const seconds = Math.max(1, Math.round(elapsedSeconds / percent * (100 - percent)));
  return seconds < 60 ? `About ${seconds} s remaining` : `About ${Math.ceil(seconds / 60)} min remaining`;
}

import type { FormatVariant } from '../stores/model';
export function exportOutputFormat(format: FormatVariant, resolution: string, quality: string, fps: string): FormatVariant {
  const factor = resolution === 'project' ? 1 : Math.min(Number(resolution) / Math.min(format.width, format.height), 3840 / Math.max(format.width, format.height));
  return { ...format, width: Math.round(format.width * factor / 2) * 2, height: Math.round(format.height * factor / 2) * 2, fps: fps === 'project' ? format.fps : Number(fps), quality: quality === 'project' ? format.quality : quality as FormatVariant['quality'] };
}
