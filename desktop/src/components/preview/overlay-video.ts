type Entry = { video: HTMLVideoElement; ready: Promise<void>; pending: Promise<void> | null };
const cache = new Map<string, Entry>();
export async function overlayVideoFrame(source: string, seconds: number, precise: boolean): Promise<HTMLVideoElement> {
  const key = `${precise ? 'export' : 'preview'}:${source}`;
  let entry = cache.get(key);
  if (!entry) {
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The overlay video took too long to load. Try an H.264 MP4.')), 15_000);
      video.onloadeddata = () => { clearTimeout(timer); resolve(); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('The overlay video could not be decoded. Try an H.264 MP4.')); };
    });
    entry = { video, ready, pending: null }; cache.set(key, entry); video.src = source; video.load();
    if (cache.size > 16) { const oldest = cache.keys().next().value; if (oldest && oldest !== key) { const old = cache.get(oldest); old?.video.pause(); old?.video.removeAttribute('src'); cache.delete(oldest); } }
  }
  await entry.ready;
  if (entry.pending) { await entry.pending; if (!precise) return entry.video; }
  const target = Math.max(0, Math.min(seconds, Math.max(0, entry.video.duration - .04)));
  if (Math.abs(entry.video.currentTime - target) < (precise ? .001 : .06)) return entry.video;
  const current = entry;
  current.pending = new Promise<void>((resolve, reject) => {
    const finish = () => { clearTimeout(timer); current.video.removeEventListener('seeked', finish); resolve(); };
    const timer = setTimeout(() => { current.video.removeEventListener('seeked', finish); reject(new Error('An overlay video frame could not be read. Try a shorter H.264 clip.')); }, 10_000);
    current.video.addEventListener('seeked', finish, { once: true }); current.video.currentTime = target;
  });
  try { await current.pending; } finally { current.pending = null; }
  return current.video;
}
