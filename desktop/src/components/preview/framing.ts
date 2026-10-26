export function framingTravel(source: { width: number; height: number }, target: { width: number; height: number }, fit: 'cover' | 'contain' | 'blur', zoom: number) {
  const scale = (fit === 'cover' ? Math.max : Math.min)(target.width / source.width, target.height / source.height) * zoom;
  return { x: Math.max(Math.abs(source.width * scale - target.width) / 2, target.width / 4), y: Math.max(Math.abs(source.height * scale - target.height) / 2, target.height / 4) };
}
