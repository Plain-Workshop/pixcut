/**
 * Generated template media. Both loops and the abstract motion background are
 * produced for PixCut and released under CC0, so every template stays offline
 * and self-contained. No third-party music or stock footage is fetched.
 */
export type TemplateAudio = { file: string; title: string; duration: number; author: string; license: string };
export type TemplateVideo = { file: string; poster: string; title: string; duration: number; author: string; license: string };

export const TEMPLATE_AUDIO = {
  'soft-pulse': { file: 'soft-pulse.m4a', title: 'Soft pulse', duration: 20, author: 'PixCut', license: 'CC0' },
  'night-drive': { file: 'night-drive.m4a', title: 'Night drive', duration: 20, author: 'PixCut', license: 'CC0' },
} satisfies Record<string, TemplateAudio>;

export const TEMPLATE_VIDEO = {
  'aurora-motion': {
    file: 'aurora-motion.mp4', poster: 'aurora-motion.jpg', title: 'Aurora motion',
    duration: 6, author: 'PixCut', license: 'CC0',
  },
} satisfies Record<string, TemplateVideo>;

export type TemplateAudioId = keyof typeof TEMPLATE_AUDIO;
export type TemplateVideoId = keyof typeof TEMPLATE_VIDEO;

function mediaUrl(file: string) {
  return `${import.meta.env.BASE_URL}templates/media/${file}`;
}

export function templateAudioUrl(id: TemplateAudioId) {
  return mediaUrl(TEMPLATE_AUDIO[id].file);
}
export function templateVideoUrl(id: TemplateVideoId) {
  return mediaUrl(TEMPLATE_VIDEO[id].file);
}
export function templateVideoPosterUrl(id: TemplateVideoId) {
  return mediaUrl(TEMPLATE_VIDEO[id].poster);
}

const cache = new Map<string, string>();

async function readAsDataUrl(file: string) {
  const cached = cache.get(file);
  if (cached) return cached;
  const response = await fetch(mediaUrl(file));
  if (!response.ok) throw new Error(`Template media ${file} could not be read.`);
  const blob = await response.blob();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Template media could not be read.'));
    reader.readAsDataURL(blob);
  });
  cache.set(file, data);
  return data;
}

export function templateAudioDataUrl(id: TemplateAudioId) {
  return readAsDataUrl(TEMPLATE_AUDIO[id].file);
}
export function templateVideoDataUrl(id: TemplateVideoId) {
  return readAsDataUrl(TEMPLATE_VIDEO[id].file);
}
export function templateVideoPosterDataUrl(id: TemplateVideoId) {
  return readAsDataUrl(TEMPLATE_VIDEO[id].poster);
}
