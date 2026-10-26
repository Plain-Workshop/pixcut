const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff']);

function rawMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

export function messageFor(error: unknown): string {
  const raw = rawMessage(error).replace(/^error:\s*/i, '').trim();
  if (!raw) return 'Something went wrong. Your work is still saved on this device.';
  const fileMatch = raw.match(/^([^\n:]+\.(png|jpe?g|webp|gif|heic|heif|avif|bmp|tiff?)):\s*(.+)$/i);
  if (fileMatch && IMAGE_EXTENSIONS.has(fileMatch[2].toLowerCase()) && /audio|mp3|wav|m4a|ogg|webm/i.test(fileMatch[3])) {
    return `“${fileMatch[1]}” is an image, not audio. Choose an MP3, WAV, M4A, OGG, or WebM audio file.`;
  }
  if (/^failed to fetch|networkerror|load failed$/i.test(raw)) return 'The local file could not be read. Try choosing it again.';
  if (/quota|storage.*full|exceeded.*quota/i.test(raw)) return 'This device is out of local storage. Remove an old project or free some disk space, then try again.';
  if (/not allowed|permission denied|eacces|eperm/i.test(raw)) return 'PixCut does not have permission to use that file. Choose another location and try again.';
  if (/no such file|not found|does not exist/i.test(raw)) return 'That file could not be found. It may have been moved or deleted.';
  return raw;
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || IMAGE_EXTENSIONS.has(file.name.split('.').pop()?.toLowerCase() ?? '');
}

export function errorTitle(message: string) {
  if (/relink|missing media/i.test(message)) return 'Media needs relinking';
  if (/invalid audio|audio track|audio clip|unsupported project|project version|project schema|invalid project/i.test(message)) return 'This project could not be opened';
  if (/audio|image|jpeg|png|webp|mp3|wav|m4a|ogg|format|decode/i.test(message)) return 'That file needs a different format';
  if (/could not be read|unreadable|corrupt|integrity/i.test(message)) return 'That file could not be read';
  if (/storage|space|quota/i.test(message)) return 'This device is out of space';
  if (/permission|access/i.test(message)) return 'PixCut needs permission';
  if (/project|version|schema/i.test(message)) return 'This project could not be opened';
  return 'Something needs attention';
}
