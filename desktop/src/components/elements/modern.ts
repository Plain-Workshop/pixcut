import { textDirection } from '../text/language';
import type { ElementLayer } from '../../stores/model';
import { fontFamily } from '../text/fonts';
import { ELEMENT_LABEL_DEFAULTS, elementForeground } from './symbols';

const kinds = new Set(['label', 'name-tag', 'link', 'quote', 'counter', 'status']);
export function isModernElement(kind: string) { return kinds.has(kind); }
export function drawModernElement(ctx: CanvasRenderingContext2D, element: ElementLayer, width: number, height: number): boolean {
  if (!isModernElement(element.kind)) return false;
  const left = -width / 2, top = -height / 2, unit = Math.min(width, height), text = element.label ?? ELEMENT_LABEL_DEFAULTS[element.kind] ?? '';
  const card = (color: string, radius: number) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(left, top, width, height, radius); ctx.fill(); };
  const fitText = (value: string, size: number, max: number, weight = 600) => {
    let fitted = size;
    ctx.font = `${weight} ${fitted}px ${fontFamily('inter')}`;
    while (ctx.measureText(value).width > max && fitted > size * .18) { fitted *= .95; ctx.font = `${weight} ${fitted}px ${fontFamily('inter')}`; }
  };
  ctx.save(); ctx.direction = textDirection(text); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (element.kind === 'name-tag') {
    card('#191B22', unit * .18);
    ctx.fillStyle = element.color; ctx.beginPath(); ctx.roundRect(left + height * .13, top + height * .2, height * .045, height * .6, height * .02); ctx.fill();
    const lines = text.split('\n'); const x = left + height * .29;
    ctx.fillStyle = '#F8F7FC'; fitText(lines[0], height * .27, width - height * .46); ctx.fillText(lines[0], x, lines[1] ? -height * .13 : 0);
    if (lines[1]) { ctx.fillStyle = '#B4B2C1'; fitText(lines.slice(1).join(' '), height * .18, width - height * .46, 400); ctx.fillText(lines.slice(1).join(' '), x, height * .2); }
  } else if (element.kind === 'quote') {
    card(element.color, unit * .13);
    ctx.fillStyle = elementForeground(element.color); ctx.font = `600 ${height * .43}px ${fontFamily('playfair')}`; ctx.fillText('“', left + height * .12, -height * .15);
    const maxWidth = width - height * .58;
    let fontSize = height * .2, lines: string[] = [];
    do {
      ctx.font = `500 ${fontSize}px ${fontFamily('inter')}`; lines = []; let line = '';
      for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) { lines.push(line); line = ''; }
        if (ctx.measureText(word).width > maxWidth) {
          for (const character of Array.from(word)) {
            if (line && ctx.measureText(line + character).width > maxWidth) { lines.push(line); line = ''; }
            line += character;
          }
        } else line = line ? `${line} ${word}` : word;
      }
      if (line) lines.push(line.trim());
      if (lines.length <= 3) break;
      fontSize *= .94;
    } while (fontSize > height * .07);
    ctx.fillStyle = elementForeground(element.color);
    lines.slice(0, 3).forEach((value, index) => ctx.fillText(value, left + height * .4, (index - (Math.min(3, lines.length) - 1) / 2) * fontSize * 1.3, maxWidth));
  } else if (element.kind === 'counter') {
    card('#1C1D25', unit * .27); ctx.strokeStyle = element.color; ctx.lineWidth = unit * .022; ctx.beginPath(); ctx.roundRect(left + unit * .025, top + unit * .025, width - unit * .05, height - unit * .05, unit * .25); ctx.stroke();
    ctx.fillStyle = element.color; ctx.textAlign = 'center'; fitText(text, height * .47, width * .76, 600); ctx.fillText(text, 0, 0);
  } else {
    card(element.color, height / 2);
    const foreground = elementForeground(element.color); ctx.fillStyle = foreground;
    let inset = height * .42;
    if (element.kind === 'link') {
      ctx.save(); ctx.translate(left + height * .28, -height * .19); ctx.scale(height * .016, height * .016); ctx.strokeStyle = foreground; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.stroke(new Path2D('M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2')); ctx.restore(); inset = height * .95;
    }
    if (element.kind === 'status') { ctx.beginPath(); ctx.arc(left + height * .45, 0, height * .075, 0, Math.PI * 2); ctx.fill(); inset = height * .72; }
    fitText(text, height * .31, width - inset - height * .34, 600); ctx.fillText(text, left + inset, 0);
  }
  ctx.restore(); return true;
}
