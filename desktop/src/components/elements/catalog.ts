import type { ElementKind, ElementLayer } from '../../stores/model';

export const ELEMENT_CATALOG: { kind: ElementKind; label: string; category: 'Text' | 'Social' | 'Utility' | 'Dynamic' | 'Shape'; color: string; animation: ElementLayer['animation'] }[] = [
  { kind: 'caption', label: 'Caption', category: 'Text', color: '#E6F2D8', animation: 'slide-up' },
  { kind: 'chapter', label: 'Chapter', category: 'Text', color: '#C5B4FF', animation: 'fade' },
  { kind: 'callout', label: 'Callout pin', category: 'Text', color: '#D4E8FF', animation: 'pop' },
  { kind: 'keycaps', label: 'Keyboard shortcut', category: 'Dynamic', color: '#C5B4FF', animation: 'fade' },
  { kind: 'mouse', label: 'Mouse interaction', category: 'Dynamic', color: '#E6F2D8', animation: 'none' },
  { kind: 'device', label: 'Device frame', category: 'Utility', color: '#D4E8FF', animation: 'fade' },
  { kind: 'comparison', label: 'Before / after', category: 'Dynamic', color: '#E6F2D8', animation: 'fade' },
  { kind: 'checklist', label: 'Checklist', category: 'Dynamic', color: '#BDE8D0', animation: 'slide-up' },
  { kind: 'rating', label: 'Rating', category: 'Dynamic', color: '#F1D49A', animation: 'fade' },
  { kind: 'countdown', label: 'Countdown', category: 'Dynamic', color: '#C5B4FF', animation: 'none' },
  { kind: 'waveform', label: 'Audio waveform', category: 'Dynamic', color: '#BDE8D0', animation: 'none' },
  { kind: 'message', label: 'Message bubble', category: 'Dynamic', color: '#D4E8FF', animation: 'pop' },
  { kind: 'qr', label: 'QR card', category: 'Utility', color: '#E6F2D8', animation: 'fade' },
  { kind: 'end-screen', label: 'End screen', category: 'Text', color: '#F4E9DA', animation: 'fade' },
  { kind: 'label', label: 'Label', category: 'Text', color: '#E6F2D8', animation: 'fade' },
  { kind: 'name-tag', label: 'Lower third', category: 'Text', color: '#C5B4FF', animation: 'slide-up' },
  { kind: 'link', label: 'Website', category: 'Text', color: '#D4E8FF', animation: 'slide-up' },
  { kind: 'quote', label: 'Quote', category: 'Text', color: '#F4E9DA', animation: 'fade' },
  { kind: 'counter', label: 'Step number', category: 'Text', color: '#C5B4FF', animation: 'pop' },
  { kind: 'status', label: 'Status badge', category: 'Text', color: '#BDE8D0', animation: 'pop' },
  { kind: 'subscribe', label: 'Subscribe', category: 'Social', color: '#F04465', animation: 'pop' },
  { kind: 'bell', label: 'Bell', category: 'Social', color: '#F1D49A', animation: 'fade' },
  { kind: 'progress', label: 'Progress', category: 'Utility', color: '#C5B4FF', animation: 'none' },
  { kind: 'location', label: 'Location', category: 'Utility', color: '#D4E8FF', animation: 'pop' },
  { kind: 'rectangle', label: 'Rectangle', category: 'Shape', color: '#C5B4FF', animation: 'fade' },
  { kind: 'ellipse', label: 'Circle', category: 'Shape', color: '#C5B4FF', animation: 'fade' },
  { kind: 'triangle', label: 'Triangle', category: 'Shape', color: '#C5B4FF', animation: 'fade' },
  { kind: 'star', label: 'Star', category: 'Shape', color: '#F1D49A', animation: 'pop' },
  { kind: 'line', label: 'Line', category: 'Shape', color: '#C5B4FF', animation: 'fade' },
  { kind: 'arrow', label: 'Arrow', category: 'Shape', color: '#C5B4FF', animation: 'fade' },
  { kind: 'sparkle', label: 'Sparkle', category: 'Shape', color: '#F1D49A', animation: 'pop' },
  { kind: 'heart', label: 'Heart', category: 'Shape', color: '#F04465', animation: 'pop' },
];
// Old projects retain their artwork and names; these no longer occupy the picker.
const legacyNames: Partial<Record<ElementKind, string>> = {
  burst: 'Sunburst', frame: 'Frame', dots: 'Dot grid', tape: 'Paper tape', chevron: 'Chevrons', like: 'Like', comment: 'Comment', share: 'Share', play: 'Play', music: 'Music', check: 'Check', cross: 'Cross', ring: 'Ring', cursor: 'Cursor', underline: 'Underline', rectangle: 'Rectangle', ellipse: 'Circle', triangle: 'Triangle', star: 'Star', sparkle: 'Sparkle', line: 'Line', arrow: 'Arrow', heart: 'Heart',
};
export function elementDisplayName(element: ElementLayer): string {
  if (element.kind === 'image' || element.kind === 'video') return element.label || (element.kind === 'image' ? 'Image overlay' : 'Video overlay');
  return ELEMENT_CATALOG.find(item => item.kind === element.kind)?.label ?? legacyNames[element.kind] ?? 'Element';
}
