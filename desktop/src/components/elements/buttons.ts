import type { ElementLayer } from '../../stores/model';
import type { ElementPreset } from './catalog';
import { textDirection } from '../text/language';
import { fontFamily } from '../text/fonts';
import { elementForeground } from './symbols';

type IconPainter = (ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, color: string, filled?: boolean) => void;

export const BUTTON_ASPECTS = [3.5, 3.8, 2.5, 1, 1, 2.8, 2.7, 2.6, 1.3, 3.2, 3.5, 3.3, 1.4, 3.8, 2.8, 1.4, 3, 3.6, 1.3, 3.2, 3.6, 2.8, 3.8, 3, 2.8, 3.2, 3.8, 3.8, 1.3, 3.6] as const;

export const buttonVariant = (p: ElementPreset) => p.variant + (p.collection === 'buttons-studio' ? 10 : p.collection === 'buttons-motion' ? 20 : 0);

/** Compact CTA artwork, shared by thumbnails, canvas preview and export. */
export function drawSocialButton(ctx: CanvasRenderingContext2D, e: ElementLayer, p: ElementPreset, w: number, h: number, seconds: number, paintIcon: IconPainter) {
  const variant = buttonVariant(p);
  const W = 600, H = W / (BUTTON_ASPECTS[variant] ?? 3), u = Math.min(W, H);
  const accent = e.color, ink = elementForeground(accent), dark = '#13151D', white = '#FFFFFF';
  const lines = (e.label ?? p.text).split('\n');
  const title = lines[0] ?? '', detail = lines.slice(1).join(' ');
  ctx.save(); ctx.scale(w / W, h / H); ctx.translate(-W / 2, -H / 2);
  const rect = (x: number, y: number, width: number, height: number, fill: string | CanvasGradient, radius: number) => {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill();
  };
  const outline = (x: number, y: number, width: number, height: number, color: string, radius: number, thickness = 2) => {
    ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.stroke();
  };
  const circle = (x: number, y: number, radius: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); };
  const icon = (name: string, x: number, y: number, size: number, color = ink) => paintIcon(ctx, name, x, y, size, color);
  const text = (value: string, x: number, y: number, size: number, color: string, max: number, align: CanvasTextAlign = 'left') => {
    ctx.direction = textDirection(value); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    let fitted = size; ctx.font = `700 ${fitted}px ${fontFamily('inter')}`;
    while (ctx.measureText(value).width > max && fitted > size * .2) { fitted *= .94; ctx.font = `700 ${fitted}px ${fontFamily('inter')}`; }
    ctx.fillText(value, x, y, max);
  };
  const gradient = ctx.createLinearGradient(0, 0, W, H); gradient.addColorStop(0, accent); gradient.addColorStop(1, '#F9E9FF');
  if (variant >= 20) {
    const v=variant-20,phase=seconds%3.2,clicked=phase>=1.1,press=Math.max(0,1-Math.abs(phase-1.1)/.16);
    const activeText=clicked&&detail?detail:title;
    ctx.translate(W/2,H/2);ctx.scale(1-press*.045,1-press*.045);ctx.translate(-W/2,-H/2);
    if(v===8){
      circle(W/2,H*.4,u*.3,accent);icon(p.icon,W/2,H*.4,u*(clicked?.4:.3),ink);
      text(activeText,W/2,H*.84,u*.08,white,W*.9,'center');
    }else if(v===7){
      rect(12,H*.08,W-24,H*.84,'#FAFAFC',H*.15);circle(H*.5,H*.5,H*.25,accent==='#FFFFFF'?'#FF596F':accent);icon(p.icon,H*.5,H*.5,H*.28,dark);
      text(title,H*.9,H*.34,H*.18,dark,W-H*1.2);rect(H*.9,H*.52,W-H*1.15,H*.25,clicked?'#D8EAD7':'#151820',H*.07);text(detail,H*.98,H*.645,H*.11,clicked?dark:white,W-H*1.4);
    }else{
      const filled=[0,3,4,5].includes(v),bg=filled?(clicked?'#DCEBD9':accent):dark,fg=filled?(clicked?dark:ink):white;
      rect(12,H*.14,W-24,H*.72,bg,v===2||v===9?H*.12:H*.36);
      if(!filled)outline(12,H*.14,W-24,H*.72,clicked?accent:'#FFFFFF30',v===2||v===9?H*.12:H*.36,2);
      const angle=v===2||v===9?Math.sin(Math.max(0,phase-1.1)*32)*(clicked?.18:0):0;
      ctx.save();ctx.translate(H*.5,H*.5);ctx.rotate(angle);icon(clicked&&v!==2&&v!==9?'check-check':p.icon,0,0,H*.31,filled?(clicked?dark:ink):accent);ctx.restore();
      text(activeText,H*.86,H*.5,H*.2,fg,W-H*1.15);
    }
    if(phase>.7&&phase<1.6){
      const x=W*.77,y=H*.68+Math.max(0,1.1-phase)*H*.25;
      ctx.save();ctx.translate(x,y);ctx.scale(H*.012,H*.012);ctx.fillStyle=white;ctx.strokeStyle=dark;ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,18);ctx.lineTo(4.5,13.5);ctx.lineTo(8.5,21.5);ctx.lineTo(11.5,20);ctx.lineTo(7.5,12);ctx.lineTo(14,12);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
    if(clicked&&phase<1.6){ctx.save();ctx.globalAlpha*=1-(phase-1.1)/.5;ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();ctx.arc(W*.77,H*.68,(phase-1.1)*H*.55+3,0,Math.PI*2);ctx.stroke();ctx.restore();}
    ctx.restore();return;
  }
  switch (variant) {
    case 0: // Raised subscribe pill with a separate play medallion.
      rect(16, H * .22, W - 32, H * .67, '#00000035', H / 2);
      rect(16, H * .13, W - 32, H * .67, gradient, H / 2);
      circle(H * .51, H * .465, H * .23, dark); icon(p.icon, H * .51, H * .465, H * .25, white);
      text(title, H * .9, H * .465, H * .22, dark, W - H * 1.15); break;
    case 1: // Minimal outline, open space, small arrow tile.
      rect(10, H * .16, W - 20, H * .68, '#141821C9', H * .16);
      outline(10, H * .16, W - 20, H * .68, accent, H * .16);
      text(title, H * .25, H * .5, H * .22, white, W - H * 1.1);
      rect(W - H * .72, H * .27, H * .46, H * .46, accent, H * .1);
      icon('arrow-up-right', W - H * .49, H * .5, H * .27); break;
    case 2: // Like and count, separated by a hairline.
      rect(12, H * .17, W - 24, H * .66, white, H * .22);
      icon(p.icon, H * .43, H * .5, H * .32, accent);
      text(title, H * .72, H * .5, H * .18, dark, W * .34);
      rect(W * .72, H * .31, 2, H * .38, '#DFE2EB', 1);
      text(detail || '1.2K', W * .85, H * .5, H * .17, dark, W * .22, 'center'); break;
    case 3: // Die-cut reaction sticker.
      ctx.save(); ctx.translate(W / 2, H * .44); ctx.rotate(-.12);
      rect(-u * .32, -u * .3, u * .64, u * .6, white, u * .2);
      rect(-u * .295, -u * .275, u * .59, u * .55, accent, u * .18);
      icon(p.icon, 0, 0, u * .36, ink); ctx.restore();
      text(title, W / 2, H * .86, u * .085, white, W * .8, 'center'); break;
    case 4: { // Floating bell with concentric signal rings, no card.
      const x = W / 2, y = H * .43;
      for (let i = 0; i < 3; i++) {
        const t = (seconds * .45 + i / 3) % 1;
        ctx.save(); ctx.globalAlpha *= (1 - t) * .45; ctx.strokeStyle = accent; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, u * (.24 + t * .17), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      circle(x, y, u * .23, accent); icon(p.icon, x, y, u * .25);
      circle(x + u * .17, y - u * .17, u * .05, white);
      text(title, W / 2, H * .88, u * .08, white, W * .86, 'center'); break;
    }
    case 5: // Bell switch with an oversized accent thumb.
      rect(12, H * .2, W - 24, H * .6, dark, H / 2);
      outline(12, H * .2, W - 24, H * .6, '#FFFFFF25', H / 2);
      text(title, H * .28, H * .5, H * .18, white, W - H * 1.1);
      circle(W - H * .45, H * .5, H * .23, accent); icon(p.icon, W - H * .45, H * .5, H * .27); break;
    case 6: // Cut-corner share button, square arrow tile.
      rect(12, H * .19, W - 24, H * .62, accent, H * .09);
      text(title, H * .26, H * .5, H * .23, ink, W - H * 1.15);
      rect(W - H * .76, H * .25, H * .5, H * .5, dark, H * .06);
      icon(p.icon, W - H * .51, H * .5, H * .3, white); break;
    case 7: // Speech bubble silhouette with its own tail.
      rect(16, H * .12, W - 32, H * .62, gradient, H * .25);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(W * .17, H * .68); ctx.lineTo(W * .17, H * .91); ctx.lineTo(W * .32, H * .68); ctx.fill();
      icon(p.icon, H * .49, H * .43, H * .29);
      text(title, H * .81, H * .43, H * .2, ink, W - H * 1.1); break;
    case 8: // Bookmark tab with a notched bottom.
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(W * .23, H * .08); ctx.lineTo(W * .77, H * .08); ctx.lineTo(W * .77, H * .9); ctx.lineTo(W * .5, H * .76); ctx.lineTo(W * .23, H * .9); ctx.closePath(); ctx.fill();
      icon(p.icon, W * .5, H * .3, u * .25);
      text(title, W * .5, H * .57, u * .09, ink, W * .44, 'center'); break;
    case 9: // Follow capsule with a detached plus key.
      rect(12, H * .18, W - H * .8, H * .64, white, H / 2);
      icon(p.icon, H * .43, H * .5, H * .29, dark);
      text(title, H * .76, H * .5, H * .2, dark, W - H * 1.7);
      circle(W - H * .37, H * .5, H * .3, accent);
      icon('plus', W - H * .37, H * .5, H * .28); break;
    case 10: // Perforated ticket, with the ends punched out of the silhouette.
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(16, H * .15);
      ctx.lineTo(W - 16, H * .15); ctx.lineTo(W - 16, H * .4);
      ctx.arc(W - 16, H * .5, H * .1, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(W - 16, H * .85); ctx.lineTo(16, H * .85); ctx.lineTo(16, H * .6);
      ctx.arc(16, H * .5, H * .1, Math.PI / 2, -Math.PI / 2, true);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.setLineDash([3, 6]); ctx.strokeStyle = ink + '65'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(H * .85, H * .23); ctx.lineTo(H * .85, H * .77); ctx.stroke(); ctx.restore();
      icon(p.icon, H * .45, H * .5, H * .3);
      text(title, H * 1.04, H * .5, H * .21, ink, W - H * 1.38); break;
    case 11: // Neon outline with a small illuminated icon tile.
      rect(12, H * .18, W - 24, H * .64, '#0F1717', H * .13);
      outline(12, H * .18, W - 24, H * .64, accent, H * .13, 3);
      rect(H * .2, H * .29, H * .42, H * .42, accent, H * .08);
      icon(p.icon, H * .41, H * .5, H * .26);
      text(title, H * .82, H * .5, H * .22, accent, W - H * 1.12); break;
    case 12: // Bell suspended in an open halo; caption below.
      ctx.save(); ctx.strokeStyle = accent; ctx.lineWidth = u * .014;
      ctx.beginPath(); ctx.ellipse(W / 2, H * .4, u * .34, u * .27, -.3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      circle(W / 2, H * .4, u * .21, dark);
      icon(p.icon, W / 2, H * .4, u * .26, accent);
      circle(W * .73, H * .24, u * .028, white);
      text(title, W / 2, H * .83, u * .075, white, W * .86, 'center'); break;
    case 13: // Editorial underline, no filled card.
      text(title, W * .07, H * .4, H * .29, white, W * .73);
      rect(W * .07, H * .7, W * .69, H * .035, accent, 1);
      icon('arrow-up-right', W * .9, H * .43, H * .36, accent); break;
    case 14: // Raised keyboard key with an offset base.
      rect(20, H * .22, W - 40, H * .66, '#00000055', H * .15);
      rect(20, H * .12, W - 40, H * .66, white, H * .15);
      outline(30, H * .17, W - 60, H * .53, '#DFE4EF', H * .12);
      icon(p.icon, H * .48, H * .44, H * .28, dark);
      text(title, H * .83, H * .44, H * .19, dark, W - H * 1.17); break;
    case 15: // Send disc with a small satellite and caption.
      circle(W / 2, H * .39, u * .28, accent);
      icon(p.icon, W / 2, H * .39, u * .29);
      circle(W * .76, H * .2, u * .063, dark);
      icon('arrow-up-right', W * .76, H * .2, u * .065, white);
      text(title, W / 2, H * .84, u * .09, white, W * .83, 'center'); break;
    case 16: // Tabbed bookmark bar.
      rect(16, H * .22, W - 32, H * .57, '#202330', H * .08);
      rect(16, H * .12, H * .67, H * .67, accent, H * .08);
      icon(p.icon, H * .41, H * .43, H * .3);
      text(title, H * .93, H * .5, H * .19, white, W - H * 1.22); break;
    case 17: // Playback capsule with progress rail.
      rect(12, H * .12, W - 24, H * .76, dark, H / 2);
      circle(H * .48, H * .5, H * .25, accent);
      icon(p.icon, H * .48, H * .5, H * .28);
      text(title, H * .91, H * .41, H * .21, white, W - H * 1.22);
      rect(H * .92, H * .66, W - H * 1.3, H * .025, '#FFFFFF25', 2);
      rect(H * .92, H * .66, (W - H * 1.3) * .55, H * .025, accent, 2); break;
    case 18: // Double outlined heart stamp.
      ctx.save(); ctx.translate(W / 2, H * .43); ctx.rotate(.08);
      rect(-u * .35, -u * .28, u * .7, u * .56, accent, u * .04);
      outline(-u * .32, -u * .25, u * .64, u * .5, ink, u * .025, 2);
      icon(p.icon, 0, 0, u * .29); ctx.restore();
      text(title, W / 2, H * .86, u * .085, white, W * .85, 'center'); break;
    case 19: // Offset stacked plates.
      rect(28, H * .25, W - 44, H * .58, accent + '50', H * .12);
      rect(18, H * .16, W - 44, H * .58, accent, H * .12);
      icon(p.icon, H * .5, H * .45, H * .3);
      text(title, H * .9, H * .45, H * .23, ink, W - H * 1.25); break;

  }
  ctx.restore();
}
