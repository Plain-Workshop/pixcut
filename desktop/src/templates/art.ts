export type TemplateKind = 'travel' | 'family' | 'birthday' | 'product' | 'social';
const cache = new Map<string, string>();
// Quiet local placeholders; imported media replaces these when a story is created.
export function templateArt(kind: TemplateKind, index: number): string {
  const key = `${kind}-${index}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the template preview. Please try again.');
  const tones = { travel: ['#183332', '#091719'], family: ['#60554C', '#292421'], birthday: ['#59394B', '#211723'], product: ['#344047', '#12191D'], social: ['#3B3B47', '#14141C'] };
  const palette = tones[kind]; const gradient = ctx.createLinearGradient(0, 0, 1600, 1600);
  gradient.addColorStop(0, palette[index % 2]); gradient.addColorStop(1, palette[(index + 1) % 2]);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1600, 1600);
  ctx.strokeStyle = '#FFFFFF16'; ctx.lineWidth = 2; ctx.strokeRect(70, 70, 1460, 1460);
  const image = canvas.toDataURL('image/png'); cache.set(key, image); return image;
}
