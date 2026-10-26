import type { ElementKind } from '../../stores/model';
export function defaultElementSize(kind: ElementKind, canvas: { width: number; height: number }) {
  const ratios: Partial<Record<ElementKind, [number, number]>> = { caption: [.6, 6], chapter: [.5, 3.8], callout: [.35, 2.8], keycaps: [.32, 4.2], mouse: [.18, 1], device: [.4, 1.5], comparison: [.72, 2], checklist: [.45, 2.2], rating: [.36, 3], countdown: [.2, 1], waveform: [.45, 4], message: [.45, 3], qr: [.2, 1], 'end-screen': [.8, 2], label: [.42, 5], 'name-tag': [.42, 3.1], link: [.42, 5], quote: [.48, 2.6], counter: [.12, 1], status: [.2, 3.1] };
  const modern = ratios[kind];
  if (modern) return { width: modern[0], height: Math.max(.02, Math.min(1, modern[0] * canvas.width / canvas.height / modern[1])) };
  const badge = kind === 'subscribe' || kind === 'like';
  const line = ['line', 'underline', 'progress'].includes(kind);
  const width = badge ? .36 : line ? .3 : .2;
  const ratio = badge ? 3.8 : line ? 16 : 1;
  return { width, height: Math.max(.02, Math.min(1, width * canvas.width / canvas.height / ratio)) };
}
