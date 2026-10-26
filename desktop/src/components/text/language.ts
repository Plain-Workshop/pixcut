/** Direction follows the first strong letter, so punctuation and counts do not
 * turn an Arabic/Hebrew label into an LTR label. Canvas still handles shaping. */
export function textDirection(value: string): CanvasDirection {
  for (const character of value) {
    if (!/\p{Letter}/u.test(character)) continue;
    return /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10FFF}\u{1E800}-\u{1EEFF}]/u.test(character) ? 'rtl' : 'ltr';
  }
  return 'ltr';
}

/** Same Unicode code-point budget as the TypeScript and Rust project models. */
export function limitElementText(value: string) {
  return Array.from(value).slice(0, 80).join('');
}
