import { textDirection } from '../text/language';
import type { ElementLayer } from '../../stores/model';
import { fontFamily } from '../text/fonts';
import { ELEMENT_LABEL_DEFAULTS, elementForeground } from './symbols';
import { behaviorTime, clamp01, clickPulses, completedItems, countdownValue, isCardElement } from './dynamic';
import { qrModules } from './qr';

/** Artwork shared by thumbnails, the editor canvas, and every export frame. */
export function drawCardElement(ctx: CanvasRenderingContext2D, e: ElementLayer, w: number, h: number, seconds: number, bars: number[] = []) {
  if (!isCardElement(e.kind)) return false;
  const x = -w / 2, y = -h / 2, u = Math.min(w, h), accent = e.color, ink = elementForeground(accent);
  const label = e.label ?? ELEMENT_LABEL_DEFAULTS[e.kind] ?? '';
  const { elapsed, phase, interval } = behaviorTime(e, seconds);
  const rect = (left: number, top: number, width: number, height: number, color: string, radius = u * .12) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(left, top, Math.max(0, width), Math.max(0, height), radius); ctx.fill();
  };
  const text = (value: string, left: number, top: number, size: number, color = '#F8F7FC', maxWidth = w * .86, align: CanvasTextAlign = 'left', weight = 600) => {
    ctx.direction = textDirection(value); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    let fitted = size; ctx.font = `${weight} ${fitted}px ${fontFamily('inter')}`;
    while (ctx.measureText(value).width > maxWidth && fitted > size * .15) { fitted *= .94; ctx.font = `${weight} ${fitted}px ${fontFamily('inter')}`; }
    ctx.fillText(value, left, top, maxWidth);
  };
  const line = (points: number[], color: string, width = u * .025) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]); ctx.stroke();
  };
  ctx.save();
  switch (e.kind) {
    case 'caption': {
      rect(x, y, w, h, '#17191FEF'); rect(x + h * .13, y + h * .18, h * .04, h * .64, accent);
      text(label, 0, 0, h * .35, '#FFFFFF', w - h * .6, 'center'); break;
    }
    case 'chapter': {
      const parts = label.split('\n');
      rect(x, y, h * .82, h, accent); text(parts[0], x + h * .41, 0, h * .38, ink, h * .65, 'center');
      line([x + h * 1.05, h * .3, w / 2, h * .3], accent, h * .025);
      text(parts.slice(1).join(' ') || 'Chapter', x + h * 1.05, -h * .03, h * .3, '#FFFFFF', w - h * 1.2); break;
    }
    case 'callout': {
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x + h * .13, h * .33, h * .09, 0, Math.PI * 2); ctx.fill();
      line([x + h * .13, h * .33, x + h * .5, -h * .12, x + h * .75, -h * .12], accent);
      rect(x + h * .72, -h * .4, w - h * .72, h * .58, accent, h * .1);
      text(label, x + h * .88, -h * .11, h * .22, ink, w - h * 1.05); break;
    }
    case 'keycaps': {
      const keys = label.split('+').map(s => s.trim()).filter(Boolean).slice(0, 5);
      const pressed = phase >= 0 && phase < .3, gap = h * .12, kw = (w - gap * (keys.length - 1)) / Math.max(1, keys.length);
      keys.forEach((key, i) => { const left = x + i * (kw + gap), down = pressed ? h * .07 : 0;
        rect(left, y + h * .12, kw, h * .86, '#101116'); rect(left, y + down, kw, h * .83, pressed ? accent : '#30333E');
        text(key, left + kw / 2, down - h * .05, h * .35, pressed ? ink : '#F8F7FC', kw * .8, 'center');
      }); break;
    }
    case 'mouse': {
      const drag = e.behavior?.variant === 'drag' ? clamp01(phase / interval) : 0;
      const cx = x + w * (.28 + drag * .45), cy = y + h * (.25 + drag * .4);
      if (e.behavior?.variant === 'drag') { ctx.setLineDash([u * .035, u * .06]); line([x + w * .28, y + h * .25, x + w * .73, y + h * .65], '#FFFFFF66', u * .015); ctx.setLineDash([]); }
      for (const age of clickPulses(e, seconds)) {
        ctx.save(); ctx.globalAlpha *= 1 - age / .55; ctx.strokeStyle = accent; ctx.lineWidth = u * .035; ctx.beginPath(); ctx.arc(cx, cy, u * (.09 + age * .53), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(u / 70, u / 70);
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#17191F'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
      const pointer = new Path2D('M0 0L7 29L13 20L23 18Z'); ctx.fill(pointer); ctx.stroke(pointer); ctx.restore(); break;
    }
    case 'device': {
      // Transparent interior lets an image/video layer underneath become the screen.
      const phone = e.behavior?.variant === 'phone';
      const bezel = u * .045;
      ctx.strokeStyle = '#E3E4EB'; ctx.lineWidth = bezel; ctx.beginPath(); ctx.roundRect(x + bezel / 2, y + bezel / 2, w - bezel, h - bezel, phone ? u * .13 : u * .06); ctx.stroke();
      rect(x + bezel, y + bezel, w - bezel * 2, h * (phone ? .09 : .14), '#22252D', u * .03);
      if (phone) rect(-w * .16, y + h * .03, w * .32, h * .027, '#0E1015');
      else { for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#F58585', '#E7C66A', '#8AC9A7'][i]; ctx.beginPath(); ctx.arc(x + h * (.07 + i * .055), y + h * .075, h * .014, 0, Math.PI * 2); ctx.fill(); } text(label, 0, y + h * .075, h * .045, '#C2C5CF', w * .55, 'center', 400); }
      break;
    }
    case 'comparison': {
      const p = elapsed < 0 ? .5 : clamp01(e.behavior?.repeat ? .5 - Math.cos(elapsed / interval * Math.PI * 2) * .4 : .1 + clamp01(elapsed / interval) * .8);
      const divider = x + w * p, labels = label.split('\n');
      rect(x, y, w * .24, h * .18, '#17191FEF'); rect(w / 2 - w * .24, y, w * .24, h * .18, accent);
      text(labels[0], x + w * .12, y + h * .09, h * .085, '#FFFFFF', w * .21, 'center'); text(labels[1] ?? 'After', w / 2 - w * .12, y + h * .09, h * .085, ink, w * .21, 'center');
      line([divider, y + h * .21, divider, h / 2], accent, h * .012);
      rect(divider - h * .09, -h * .09, h * .18, h * .18, accent, h * .09); text('‹ ›', divider, 0, h * .085, ink, h * .14, 'center'); break;
    }
    case 'checklist': {
      const items = label.split('\n').filter(Boolean).slice(0, 5), done = completedItems(e, seconds, items.length), row = h * .8 / Math.max(1, items.length);
      rect(x, y, w, h, '#191C23F2');
      items.forEach((value, i) => {
        const cy = y + h * .1 + row * (i + .5), size = row * .48, bx = x + h * .12;
        rect(bx, cy - size / 2, size, size, i < done ? accent : '#343843', size * .25);
        if (i < done) line([bx + size * .22, cy, bx + size * .44, cy + size * .2, bx + size * .8, cy - size * .22], ink, size * .1);
        text(value, bx + size + h * .09, cy, row * .34, i < done ? '#F8F7FC' : '#B6BAC7', w - size - h * .4);
      }); break;
    }
    case 'rating': {
      const ratingTime = e.behavior?.repeat && elapsed >= 0 ? elapsed % (interval * 6) : elapsed;
      rect(x, y, w, h, '#191C23F2'); const value = Math.max(0, Math.min(5, e.behavior?.countFrom ?? 5));
      for (let i = 0; i < 5; i++) {
        const cx = x + w * (.15 + i * .175), cy = -h * .08, r = Math.min(h * .2, w * .07);
        ctx.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, radius = j % 2 ? r * .47 : r; const px = cx + Math.cos(a) * radius, py = cy + Math.sin(a) * radius; if (!j) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath();
        ctx.fillStyle = i < value && ratingTime >= i * interval ? accent : '#383C47'; ctx.fill();
      }
      text(label, 0, h * .3, h * .14, '#C5C7D1', w * .86, 'center', 400); break;
    }
    case 'countdown': {
      const value = countdownValue(e, seconds), from = Math.round(e.behavior?.countFrom ?? 5), to = Math.round(e.behavior?.countTo ?? 0);
      const progress = from === to ? 1 : clamp01(Math.abs(value - from) / Math.abs(to - from));
      const radius = u * .43; ctx.strokeStyle = '#363843'; ctx.lineWidth = u * .045; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = accent; ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
      text(String(value), 0, -h * .025, u * .43, '#FFFFFF', w * .65, 'center'); text(label, 0, h * .25, u * .09, accent, w * .6, 'center'); break;
    }
    case 'waveform': {
      const gap = w / Math.max(1, bars.length);
      bars.forEach((value, i) => { const height = Math.max(h * .035, value * h * .86); rect(x + gap * i, -height / 2, gap * .6, height, accent, gap * .3); }); break;
    }
    case 'message': {
      rect(x, y, w, h * .87, accent, u * .2);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(x + h * .18, h * .28); ctx.lineTo(x + h * .12, h * .49); ctx.lineTo(x + h * .4, h * .28); ctx.fill();
      if (elapsed < 0) {
        for (let i = 0; i < 3; i++) { ctx.save(); ctx.globalAlpha *= .35 + .65 * ((Math.sin(seconds * 7 - i * 1.3) + 1) / 2); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc((i - 1) * h * .18, -h * .06, h * .045, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      } else text(label, x + h * .22, -h * .065, h * .23, ink, w - h * .44);
      break;
    }
    case 'qr': {
      rect(x, y, w, h, '#FFFFFF', u * .045);
      try {
        const matrix = qrModules(label || 'https://example.com'), module = u / (matrix.length + 8);
        ctx.fillStyle = '#101218';
        matrix.forEach((row, iy) => row.forEach((dark, ix) => { if (dark) ctx.fillRect(-u / 2 + (ix + 4) * module, -u / 2 + (iy + 4) * module, module + .015, module + .015); }));
      } catch { text('Edit QR text', 0, 0, u * .1, '#17191F', w * .8, 'center'); }
      break;
    }
    case 'end-screen': {
      const parts = label.split('\n');
      text(parts[0], 0, y + h * .12, h * .11, '#FFFFFF', w * .9, 'center');
      text(parts.slice(1).join(' '), 0, y + h * .27, h * .055, accent, w * .9, 'center', 400);
      ctx.strokeStyle = accent; ctx.lineWidth = h * .008;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.roundRect(x + w * (.04 + i * .49), y + h * .4, w * .43, h * .55, h * .035); ctx.stroke(); }
      break;
    }
  }
  ctx.restore(); return true;
}
