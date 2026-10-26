import { resolveMediaSource } from './media-url';

/** Read a local video file as a data URL so the preview can play it offline. */
export function videoFileData(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`“${file.name}” could not be read. Try choosing it again.`));
    reader.readAsDataURL(file);
  });
}

export type VideoProbe = { duration: number; width: number; height: number; poster: string };

/**
 * Decode enough of a video to learn its duration and capture a poster frame.
 * Browsers that cannot decode the codec reject here, before a broken scene is
 * written into the project.
 */
export function probeVideo(src: string): Promise<VideoProbe> {
  return new Promise<VideoProbe>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const finish = (error?: Error, value?: VideoProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = window.setTimeout(() => finish(new Error('That video took too long to decode. Try a shorter H.264 MP4.')), 20000);
    video.onerror = () => finish(new Error('That video format could not be decoded. Try an H.264 MP4 or MOV.'));
    video.onloadeddata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
        finish(new Error('That video has no readable frames. Try another file.'));
        return;
      }
      const at = Math.min(Math.max(video.duration * 0.1, 0), Math.max(0, video.duration - 0.05));
      const capture = () => {
        try {
          const width = 480;
          const height = Math.max(16, Math.round(width * video.videoHeight / video.videoWidth));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(video, 0, 0, width, height);
          finish(undefined, {
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            poster: canvas.toDataURL('image/jpeg', 0.82),
          });
        } catch {
          finish(new Error('A preview frame could not be captured from that video.'));
        }
      };
      video.onseeked = capture;
      try {
        video.currentTime = at;
      } catch {
        capture();
      }
    };
    void resolveMediaSource(src).then(url => {
      if (settled) return;
      if (!url) { finish(new Error('That video is missing from the local store. Relink it.')); return; }
      video.src = url;
      video.load();
    }, error => finish(error instanceof Error ? error : new Error(String(error))));
  });
}
