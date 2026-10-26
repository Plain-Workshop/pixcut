import qrcode from 'qrcode-generator';
const cache = new Map<string, boolean[][]>();
/** The QR contains only the supplied text. Generation is entirely local. */
export function qrModules(text: string): boolean[][] {
  const hit = cache.get(text); if (hit) return hit;
  // Byte-mode UTF-8, including non-Latin links; do not mutate the library global.
  const bytes = new TextEncoder().encode(text);
  const encoded = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  const code = qrcode(0, 'M'); code.addData(encoded, 'Byte'); code.make();
  const size = code.getModuleCount();
  const matrix = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => code.isDark(row, col)));
  cache.set(text, matrix); if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return matrix;
}
