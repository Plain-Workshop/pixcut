import { useEffect, useRef, useState } from 'react';
import { cachedWaveform, decodeWaveform, drawWaveform, waveformRange, type WaveformPeaks } from './waveform-data';

type Props = {
  clipId: string;
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

/**
 * Lightweight audio waveform for a timeline clip. It decodes once per clip and
 * only redraws when the visible source window changes, so trimming is cheap.
 */
export function Waveform({ clipId, data, sourceInSeconds, durationSeconds, sourceDurationSeconds }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(() => cachedWaveform(clipId, data.length));
  const loadable = data.length <= MAX_WAVEFORM_DATA && sourceDurationSeconds <= MAX_WAVEFORM_SECONDS;

  useEffect(() => {
    if (!loadable) { setPeaks(null); return; }
    let live = true;
    const ready = cachedWaveform(clipId, data.length);
    if (ready) { setPeaks(ready); return () => { live = false; }; }
    setPeaks(null);
    void decodeWaveform(clipId, data).then(result => {
      if (live) setPeaks(result);
    });
    return () => { live = false; };
  }, [clipId, data.length, loadable]);

  useEffect(() => {
    if (!peaks || !canvas.current) return;
    const { start, end } = waveformRange(peaks, sourceInSeconds, durationSeconds, sourceDurationSeconds);
    drawWaveform(canvas.current, peaks, start, end);
  }, [peaks, sourceInSeconds, durationSeconds, sourceDurationSeconds]);

  return <canvas ref={canvas} className="audio-waveform" width={512} height={64} aria-hidden="true" />;
}
