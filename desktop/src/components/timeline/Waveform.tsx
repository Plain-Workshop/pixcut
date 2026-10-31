import { useEffect, useRef, useState } from 'react';
import { cachedWaveform, decodeWaveform, drawWaveform, waveformRange, type WaveformResult } from './waveform-data';
import { t } from '../../i18n';

type Props = {
  data: string;
  sourceInSeconds: number;
  durationSeconds: number;
  sourceDurationSeconds: number;
};

// Decoding is fast at 8 kHz, but a multi-hour stereo file would still allocate
// hundreds of megabytes. Very long clips keep their timing controls and simply
// skip the decorative waveform.
const MAX_WAVEFORM_SECONDS = 900;
const MAX_WAVEFORM_DATA = 40_000_000;
/** Canvases wider than this are clamped; browsers refuse very large bitmaps. */
const MAX_CANVAS_PX = 4096;

/** Decoded peaks for a source, shared across every clip cut from it. `null` = no audio in it. */
export function useWaveform(data: string, sourceDurationSeconds: number) {
  const loadable = data.length <= MAX_WAVEFORM_DATA && sourceDurationSeconds <= MAX_WAVEFORM_SECONDS;
  const [result, setResult] = useState<WaveformResult | null | undefined>(() => loadable ? cachedWaveform(data) : undefined);
  useEffect(() => {
    if (!loadable) { setResult(undefined); return; }
    let live = true;
    const ready = cachedWaveform(data);
    setResult(ready);
    if (ready === undefined) void decodeWaveform(data).then(next => { if (live) setResult(next); });
    return () => { live = false; };
  }, [data, loadable]);
  return result;
}

/**
 * Audio waveform for a timeline clip. It decodes once per source, then draws
 * one peak per device pixel for the visible source window, so trims and zoom
 * stay sharp.
 */
export function Waveform({ data, sourceInSeconds, durationSeconds, sourceDurationSeconds }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const result = useWaveform(data, sourceDurationSeconds);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !result) return;
    const draw = () => {
      const ratio = globalThis.devicePixelRatio || 1;
      element.width = Math.max(1, Math.min(MAX_CANVAS_PX, Math.round(element.clientWidth * ratio)));
      element.height = Math.max(1, Math.round(element.clientHeight * ratio));
      const { start, end } = waveformRange(result.peaks, sourceInSeconds, durationSeconds, sourceDurationSeconds || result.duration);
      drawWaveform(element, result.peaks, start, end);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [result, sourceInSeconds, durationSeconds, sourceDurationSeconds]);

  return <canvas ref={canvas} className="audio-waveform" width={512} height={64} aria-hidden="true" />;
}

/** Shown on video clips whose file has no audio track, instead of an empty lane. */
export function NoSoundBadge({ data, sourceDurationSeconds }: { data: string; sourceDurationSeconds: number }) {
  const result = useWaveform(data, sourceDurationSeconds);
  return result === null ? <span className="audio-no-sound" title={t('No audio could be read from this clip')}>{t('No sound')}</span> : null;
}
