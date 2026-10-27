import { textDirection } from '../text/language';
import { BUTTON_ASPECTS, buttonVariant, drawSocialButton } from './buttons';
import type { ElementLayer } from '../../stores/model';
import { elementPreset, type ElementPreset } from './catalog';
import { PRESET_ICONS } from './preset-icons';
import { fontFamily } from '../text/fonts';
import { elementForeground } from './symbols';
import { countdownValue, completedItems } from './dynamic';
import { drawCardElement } from './cards';

let fontsReady: Promise<void> | undefined;
export function prepareDesignerFonts(label = ''): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const base = fontsReady ??= Promise.all(['inter','space-grotesk','playfair','caveat'].map(font => document.fonts.load(`600 24px ${fontFamily(font)}`))).then(() => undefined).catch(() => undefined);
  return base.then(async () => { if (label) await document.fonts.load(`700 24px ${fontFamily('inter')}`, label).catch(() => {}); });
}

export function presetAspect(p: ElementPreset): number {
  if (p.collection === 'buttons' || p.collection === 'buttons-studio' || p.collection === 'buttons-motion') return BUTTON_ASPECTS[buttonVariant(p)] ?? 3;
  if (p.kind === 'qr') return 1;
  if (p.kind === 'mouse') return 1.2;
  if (p.kind === 'keycaps') return 4;
  if (p.behavior?.variant === 'phone') return .58;
  return ({creator:3.1,'lower-thirds':3.6,captions:3,chapters:3.4,notifications:3,tutorials:2.7,timers:1.25,audio:2.5,screens:1.6,travel:1.9,food:1.65,fitness:2.1,shopping:1.7,events:1.9,reactions:1,badges:1,data:2.1,callouts:2.7,'end-screens':2,stories:1.9} as Record<string,number>)[p.collection] ?? 2;
}
export function presetSize(p: ElementPreset, canvas: {width:number;height:number}) {
  const ratio=presetAspect(p), wanted=['end-screens','screens'].includes(p.collection)?.64:ratio<1.4?.25:.43;
  const width=Math.min(wanted,.75*canvas.height/canvas.width*ratio);
  return {width,height:Math.max(.02,width*canvas.width/canvas.height/ratio)};
}
export function drawPresetIcon(ctx:CanvasRenderingContext2D,name:string,x:number,y:number,size:number,color:string,filled=false) {
  ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/24,size/24);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.65;ctx.lineCap='round';ctx.lineJoin='round';
  for(const [tag,a] of PRESET_ICONS[name]??[]) {
    const n=(key:string)=>Number(a[key]??0);let path:Path2D;
    if(tag==='path')path=new Path2D(String(a.d));
    else {path=new Path2D();if(tag==='circle')path.arc(n('cx'),n('cy'),n('r'),0,Math.PI*2);else if(tag==='ellipse')path.ellipse(n('cx'),n('cy'),n('rx'),n('ry'),0,0,Math.PI*2);else if(tag==='rect')path.roundRect(n('x'),n('y'),n('width'),n('height'),n('rx'));else if(tag==='line'){path.moveTo(n('x1'),n('y1'));path.lineTo(n('x2'),n('y2'));}else if(tag==='polyline'||tag==='polygon'){const points=String(a.points).trim().split(/[ ,]+/).map(Number);path.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)path.lineTo(points[i],points[i+1]);if(tag==='polygon')path.closePath();}}
    if(filled&&tag!=='line'&&tag!=='polyline'){ctx.save();ctx.globalAlpha*=.15;ctx.fill(path);ctx.restore();}ctx.stroke(path);
  }ctx.restore();
}
/** Art-directed collections, each with ten purposeful compositions. No downloaded artwork. */
export function drawDesignerElement(ctx:CanvasRenderingContext2D,e:ElementLayer,w:number,h:number,seconds:number,bars:number[]=[]) {
  const p=elementPreset(e);if(!p)return false;
  if(p.collection==='buttons'||p.collection==='buttons-studio'||p.collection==='buttons-motion'){drawSocialButton(ctx,e,p,w,h,seconds,drawPresetIcon);return true;}
  const W=600,H=W/presetAspect(p),u=Math.min(W,H),v=p.variant,a=e.color,ink=elementForeground(a),dark='#141821',white='#F8FAFF',muted='#ADB6C9';
  const lines=(e.label??p.text).split('\n'),title=lines[0]??'',sub=lines.slice(1).join(' '),phase=(Math.sin(seconds*.9+v)+1)/2;
  ctx.save();ctx.scale(w/W,h/H);ctx.translate(-W/2,-H/2);
  const box=(x:number,y:number,bw:number,bh:number,fill:string,r=u*.08)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,Math.max(0,bw),Math.max(0,bh),Math.max(0,r));ctx.fill();};
  const edge=(x:number,y:number,bw:number,bh:number,color=a,r=u*.08,line=1.5)=>{ctx.strokeStyle=color;ctx.lineWidth=line;ctx.beginPath();ctx.roundRect(x,y,bw,bh,r);ctx.stroke();};
  const circle=(x:number,y:number,r:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  const stroke=(pts:number[],color:string,width=2)=>{ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);ctx.stroke();};
  const text=(s:string,x:number,y:number,size:number,color=white,max=W*.8,align:CanvasTextAlign='left',weight=600,font='inter')=>{ctx.direction=textDirection(s);ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;let f=size;ctx.font=`${weight} ${f}px ${fontFamily(font)}`;while(ctx.measureText(s).width>max&&f>size*.18){f*=.95;ctx.font=`${weight} ${f}px ${fontFamily(font)}`;}ctx.fillText(s,x,y,max);};
  const icon=(x:number,y:number,size:number,color=a)=>drawPresetIcon(ctx,p.icon,x,y,size,color,true);
  const gradient=(c1:string,c2:string)=>{const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,c1);g.addColorStop(1,c2);return g;};
  const panel=(style=v)=>{if(style%4===0){ctx.fillStyle=gradient('#282D3D',dark);ctx.beginPath();ctx.roundRect(3,3,W-6,H-6,u*.1);ctx.fill();edge(3,3,W-6,H-6,a+'70');}else if(style%4===1){box(3,3,W-6,H-6,a);edge(12,12,W-24,H-24,ink+'35',u*.07);}else if(style%4===2){box(3,3,W-6,H-6,'#F1EEE7');box(3,3,9,H-6,a,4);}else{box(3,3,W-6,H-6,dark);edge(8,8,W-16,H-16,a,u*.1,2.5);}};
  const panelInk=v%4===1?ink:v%4===2?dark:white,panelSub=v%4===1?ink:v%4===2?'#5B6272':muted;
  const chip=(label:string,x:number,y:number,width:number,height:number,color=a)=>{box(x,y,width,height,color,height/2);text(label,x+width/2,y+height/2,height*.36,elementForeground(color),width*.84,'center',700);};
  const trace=(x:number,y:number,bw:number,bh:number,color=a)=>{ctx.save();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<30;i++){const px=x+i/29*bw,py=y+bh*(.75-.5*i/29+.08*Math.sin(i*.8+v));if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();circle(x+bw,y+bh*(.25+.08*Math.sin(29*.8+v)),4+phase*2,color);ctx.restore();};
  const miniBars=(x:number,y:number,bw:number,bh:number)=>{const gap=bw/Math.max(1,bars.length);bars.forEach((value,i)=>{const height=Math.max(3,value*bh);box(x+i*gap,y+(bh-height)/2,gap*.58,height,a,gap*.25);});};
  switch(p.collection) {
    case 'creator': {
      if(v===0||v===5){box(7,10,W-14,H-20,a,H*.28);circle(H*.48,H/2,H*.28,ink);icon(H*.48,H/2,H*.31,a);text(title,H*.9,H*.43,H*.2,ink,W-H*1.1);text(sub,H*.9,H*.66,H*.09,ink,W-H*1.1);circle(W-40,H/2,4+phase*2,ink);}
      else if(v===1||v===7){panel();circle(H*.49,H/2,H*.3,panelInk+'15');icon(H*.49,H/2,H*.31,panelInk);text(title,H*.9,H*.38,H*.21,panelInk,W-H*1.1);text(sub,H*.9,H*.65,H*.11,panelSub,W-H*1.1);}
      else if(v===2||v===8){ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.035);box(-W*.46,-H*.39,W*.92,H*.78,dark,H*.12);edge(-W*.46,-H*.39,W*.92,H*.78,a,H*.12,2);icon(-W*.32,0,H*.37);text(title,-W*.2,-H*.08,H*.19,white,W*.6);text(sub,-W*.2,H*.15,H*.1,muted,W*.6);ctx.restore();}
      else{panel();icon(W*.1,H*.5,H*.36,panelInk);text(title,W*.21,H*.4,H*.21,panelInk,W*.64);text(sub,W*.21,H*.65,H*.105,panelSub,W*.64);stroke([W*.92,H*.4,W*.95,H*.5,W*.92,H*.6],panelInk,3);}break;
    }
    case 'lower-thirds': {
      if(v===0||v===8){box(0,H*.2,7,H*.6,a,3);text(title,30,H*.42,H*.27,white,W*.86, 'left',700,v===8?'playfair':'inter');text(sub,30,H*.76,H*.12,a);}
      else if(v===1||v===3){box(0,H*.06,W*.92,H*.61,a,8);box(25,H*.68,W*.8,H*.26,dark,5);text(title,24,H*.36,H*.25,ink,W*.84);text(sub,43,H*.81,H*.11,white,W*.72);}
      else if(v===2||v===7){panel();icon(H*.5,H*.5,H*.4,panelInk);stroke([H*.95,H*.22,H*.95,H*.78],panelInk+'60');text(title,H*1.08,H*.4,H*.24,panelInk,W-H*1.2);text(sub,H*1.08,H*.7,H*.12,panelSub,W-H*1.2);}
      else if(v===5){box(0,0,W,H,dark,7);box(0,0,W,H*.18,a,4);for(let i=0;i<12;i++)box(i*W/12+6,6,W/24,H*.1,dark,0);text(title,24,H*.52,H*.25,white);text(sub,24,H*.8,H*.12,a);}
      else{box(4,4,W-8,H-8,'#121720DD',H*.15);icon(H*.48,H*.5,H*.36);text(title,H*.86,H*.4,H*.24,white,W-H);text(sub,H*.86,H*.7,H*.115,a,W-H);stroke([H*.86,H*.87,H*.86+(W-H)*(.3+phase*.7),H*.87],a,2);}break;
    }
    case 'captions': {
      if(v===0||v===2||v===8){box(W*.03,H*.07,W*.94,H*.37,a,8);text(title,W*.5,H*.26,H*.22,ink,W*.86,'center',800);box(W*.08,H*.53,W*.84,H*.37,dark,8);text(sub,W*.5,H*.72,H*.15,white,W*.77,'center',600);}
      else if(v===3||v===6){panel();icon(W*.1,H*.31,H*.24,panelInk);text(title,W*.18,H*.3,H*.16,panelInk,W*.74);text(sub,W*.08,H*.67,H*.22,panelInk,W*.84,'left',700);}
      else{text(title,W*.5,H*.32,H*.28,white,W*.94,'center',v===9?500:800,v===9?'playfair':'inter');box(W*.1,H*.57,W*.8,H*.27,a,5);text(sub,W*.5,H*.705,H*.14,ink,W*.74,'center',600);stroke([W*.25,H*.96,W*(.45+phase*.3),H*.96],a,3);}break;
    }
    case 'chapters': {
      if(v%3===0){text(title,W*.02,H*.45,H*.62,a,W*.3,'left',700,'space-grotesk');stroke([W*.35,H*.16,W*.35,H*.85],a,2);text(sub,W*.4,H*.5,H*.24,white,W*.57);}
      else if(v%3===1){panel();chip(title,W*.04,H*.16,W*.25,H*.3,v%4===1?dark:a);text(sub,W*.06,H*.7,H*.25,panelInk,W*.86);icon(W*.9,H*.28,H*.23,panelInk);}
      else{box(0,H*.06,W*.27,H*.88,a,12);icon(W*.135,H*.5,H*.4,ink);text(title,W*.32,H*.3,H*.14,a,W*.65);text(sub,W*.32,H*.66,H*.27,white,W*.65);}break;
    }
    case 'notifications': {
      panel();circle(H*.43,H*.43,H*.23,a);icon(H*.43,H*.43,H*.27,ink);text(title,H*.82,H*.3,H*.16,panelInk,W-H*.98);if(e.kind==='message' && seconds<(e.behavior?.atSeconds??1)){for(let i=0;i<3;i++){ctx.save();ctx.globalAlpha*=.35+.65*(Math.sin(seconds*7-i*1.3)+1)/2;circle(H*(.86+i*.11),H*.6,H*.025,panelInk);ctx.restore();}}else text(sub,H*.82,H*.6,H*.16,panelInk,W-H*.98,'left',500);stroke([H*.82,H*.82,W*.85,H*.82],panelSub+'55',1);circle(W-24,24,3+phase*2,panelInk);break;
    }
    case 'tutorials': {
      if(['mouse','keycaps','checklist','comparison'].includes(e.kind)){ctx.save();ctx.translate(W/2,H/2);const inner={...e,presetId:undefined,label:e.label??p.text};drawCardElement(ctx,inner,W*.94,H*.86,seconds,bars);ctx.restore();if(e.kind==='mouse'){chip(e.label??p.text,W*.12,H*.8,W*.76,H*.15);}}
      else{panel();box(W*.04,H*.16,H*.54,H*.54,a,H*.12);icon(W*.04+H*.27,H*.43,H*.29,ink);text(title,H*.75,H*.31,H*.14,panelInk,W-H*.9);text(sub,H*.75,H*.65,H*.17,panelInk,W-H*.9);}break;
    }
    case 'timers': {
      const value=countdownValue(e,seconds),digits=String(value).padStart(2,'0');
      if(v===1||v===6){const gap=12,bw=(W*.86-gap)/2;[...digits.slice(-2)].forEach((d,i)=>{const x=W*.07+i*(bw+gap);box(x,H*.15,bw,H*.62,dark,18);edge(x,H*.15,bw,H*.62,a+'66',18);text(d,x+bw/2,H*.465,H*.48,white,bw*.85,'center',700,'space-grotesk');stroke([x,H*.46,x+bw,H*.46],'#00000070',2);});text(title,W/2,H*.88,H*.055,a,W*.85,'center');}
      else if(v===2||v===8){panel();icon(W*.5,H*.2,H*.13,panelInk);text(String(value),W*.5,H*.51,H*.46,panelInk,W*.85,'center',800,'space-grotesk');chip(title,W*.12,H*.82,W*.76,H*.1,v%4===1?dark:a);}
      else{const r=u*.33;ctx.lineWidth=u*.025;ctx.strokeStyle='#FFFFFF22';ctx.beginPath();ctx.arc(W/2,H*.45,r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=a;ctx.beginPath();ctx.arc(W/2,H*.45,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(.2+(seconds%5)/5*.8));ctx.stroke();text(String(value),W*.5,H*.45,u*.43,white,W*.7,'center',700,'space-grotesk');icon(W*.5,H*.85,H*.07);text(title,W*.5,H*.95,H*.05,a,W*.9,'center');}break;
    }
    case 'audio': {
      if(v===3){miniBars(12,H*.12,W-24,H*.76);break;}
      panel();if(v===4||v===1){const r=H*.33;circle(H*.45,H*.46,r,'#080B12');ctx.save();ctx.translate(H*.45,H*.46);ctx.rotate(seconds*.45);for(let i=0;i<5;i++){ctx.strokeStyle='#FFFFFF18';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*(.5+i*.1),0,Math.PI*2);ctx.stroke();}circle(0,0,r*.38,a);icon(0,0,r*.45,ink);ctx.restore();text(title,H*.9,H*.25,H*.16,panelInk,W-H);text(sub,H*.9,H*.45,H*.085,panelSub,W-H);miniBars(H*.9,H*.63,W-H*1.05,H*.2);}
      else{icon(H*.35,H*.33,H*.3,panelInk);text(title,H*.64,H*.25,H*.13,panelInk,W-H*.8);text(sub,H*.64,H*.45,H*.08,panelSub,W-H*.8);miniBars(W*.06,H*.62,W*.88,H*.23);}break;
    }
    case 'screens': {
      if(e.kind==='qr'){ctx.save();ctx.translate(W/2,H/2);drawCardElement(ctx,{...e,presetId:undefined},W*.88,H*.88,seconds);ctx.restore();break;}
      if(v===4){panel();circle(W*.5,H*.27,H*.13,a);icon(W*.5,H*.27,H*.16,ink);text(title,W*.5,H*.59,H*.095,panelInk,W*.83,'center');stroke([W*.22,H*.76,W*.78,H*.76],panelInk+'65',1.5);for(let i=0;i<3;i++)circle(W*(.46+i*.04),H*.87,2.5,panelInk);break;}
      if(v===2){edge(8,8,W-16,H*.79,'#DCE1EE',16,8);box(W*.46,H*.81,W*.08,H*.12,'#DCE1EE',4);box(W*.31,H*.93,W*.38,H*.025,'#DCE1EE',6);text(title,W*.5,H*.755,H*.025,muted,W*.7,'center',400);break;}
      if(v===6){edge(7,7,W-14,H-14,'#DCE1EE',40,14);edge(25,25,W-60,H-50,'#687287',24,1.5);circle(W-21,H*.5,5,'#DCE1EE');text(title,W*.5,H-15,H*.018,'#687287',W*.6,'center',400);break;}
      if(v===7){for(const pts of [[12,H*.2,12,12,95,12],[W-95,12,W-12,12,W-12,H*.2],[12,H*.8,12,H-12,95,H-12],[W-95,H-12,W-12,H-12,W-12,H*.8]])stroke(pts,a,5);stroke([W*.47,H*.5,W*.53,H*.5],a+'70',1);stroke([W*.5,H*.45,W*.5,H*.55],a+'70',1);circle(W*.9,H*.11,5,'#FF718F');text(title,W*.5,H*.91,H*.04,a,W*.7,'center');break;}
      const phone=e.behavior?.variant==='phone'||p.behavior?.variant==='phone',border=phone?14:8;
      edge(border/2,border/2,W-border,H-border,'#DCE1EE',phone?65:20,border);
      if(phone){box(W*.31,18,W*.38,24,dark,12);box(W*.35,H-24,W*.3,5,'#DCE1EE',3);}
      else{box(8,8,W-16,H*.1,dark,12);for(let i=0;i<3;i++)circle(26+i*18,H*.055,4,['#FF8E9E','#FFD58A','#A9E6CD'][i]);text(title,W/2,H*.055,H*.032,muted,W*.55,'center',400);if(v===3){box(8,H*.11,W*.15,H*.87,'#1A202ACC',6);for(let i=0;i<5;i++){circle(W*.045,H*(.21+i*.12),3,a);box(W*.07,H*(.2+i*.12),W*.06,3,'#8A94AA',1);}}if(v===8){for(let i=0;i<3;i++)box(W*(.06+i*.3),H*.14,W*.25,H*.065,i===0?a+'55':'#FFFFFF12',4);box(W*.08,H*.93,W*(.35+phase*.45),3,a,1);}if(v===7){for(const pts of [[20,H*.18,20,H*.12,65,H*.12],[W-65,H*.12,W-20,H*.12,W-20,H*.18],[20,H*.87,20,H*.94,65,H*.94],[W-65,H*.94,W-20,H*.94,W-20,H*.87]])stroke(pts,a,4);}}
      break;
    }
    case 'travel': {
      if(v===0||v===2){box(4,4,W-8,H-8,'#EEECE3',20);box(4,4,W*.22,H-8,a,18);icon(W*.11,H*.34,H*.22,ink);ctx.save();ctx.translate(W*.11,H*.69);ctx.rotate(-Math.PI/2);stroke([-H*.25,0,H*.25,0],ink+'60',2);ctx.restore();text(title,W*.29,H*.2,H*.075,dark,W*.6);text(sub,W*.29,H*.4,H*.14,dark,W*.6);stroke([W*.27,H*.6,W*.94,H*.6],'#00000030',1);circle(W*.31,H*.7,3,dark);stroke([W*.34,H*.7,W*.88,H*.7],'#5B627270',1);circle(W*.9,H*.7,3,dark);for(let i=0;i<35;i++)box(W*.3+i*W*.018,H*.82,i%3===0?3:1,H*.09,dark,0);}
      else if(v===5){ctx.save();ctx.translate(W*.5,H*.5);ctx.rotate(-.12);edge(-W*.42,-H*.4,W*.84,H*.8,a,24,4);edge(-W*.39,-H*.35,W*.78,H*.7,a,18,1);icon(0,-H*.12,H*.28);text(title,0,H*.13,H*.085,a,W*.72,'center',800);text(sub,0,H*.29,H*.06,a,W*.72,'center');ctx.restore();}
      else{panel();icon(W*.17,H*.32,H*.28,panelInk);text(title,W*.08,H*.61,H*.1,panelInk,W*.84);text(sub,W*.08,H*.8,H*.085,panelSub,W*.84);ctx.save();ctx.setLineDash([4,8]);stroke([W*.35,H*.32,W*.88,H*.32],panelInk+'60',2);ctx.restore();circle(W*.88,H*.32,5+phase*2,panelInk);}break;
    }
    case 'food': {
      panel();if(v%3===0){box(W*.07,H*.09,W*.86,H*.39,a,14);icon(W*.5,H*.28,H*.26,ink);text(title,W*.5,H*.61,H*.09,panelInk,W*.82,'center',700);text(sub,W*.5,H*.8,H*.08,panelSub,W*.82,'center',400);}
      else if(v%3===1){icon(W*.5,H*.29,H*.35,panelInk);text(title,W*.5,H*.61,H*.12,panelInk,W*.8,'center',600,'playfair');stroke([W*.27,H*.74,W*.73,H*.74],panelInk+'55',1);text(sub,W*.5,H*.87,H*.055,panelSub,W*.85,'center',400);}
      else{icon(W*.16,H*.25,H*.22,panelInk);stroke([W*.33,H*.24,W*.88,H*.24],panelSub+'50',1);text(title,W*.08,H*.49,H*.13,panelInk,W*.85);text(sub,W*.08,H*.72,H*.075,panelSub,W*.85);for(let i=0;i<3;i++)circle(W*.09+i*16,H*.9,3,panelInk);}break;
    }
    case 'fitness': {
      panel();text(title,W*.06,H*.18,H*.075,panelSub,W*.72);icon(W*.86,H*.22,H*.18,panelInk);
      if(v===2||v===5){text(v===2?title.split(' ')[0]:'↗',W*.06,H*.55,H*.4,panelInk,W*.43,'left',800,'space-grotesk');trace(W*.52,H*.37,W*.4,H*.3,panelInk);}
      else if(v===3||v===7){stroke([W*.08,H*.48,W*.21,H*.48,W*.25,H*.36,W*.31,H*.68,W*.38,H*.35,W*.44,H*.49,W*.58,H*.49,W*.65,H*.43,W*.72,H*.49,W*.91,H*.49],panelInk,3);circle(W*(.08+phase*.83),H*.49,4,panelInk);}
      else{icon(W*.18,H*.51,H*.32,panelInk);for(let i=0;i<10;i++)box(W*.37+i*W*.051,H*.38,W*.026,H*.3,i<7?panelInk:panelInk+'28',4);}
      text(sub,W*.06,H*.86,H*.075,panelInk,W*.88);break;
    }
    case 'shopping': {
      if(v===3||v===2){ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.045);box(-W*.44,-H*.42,W*.88,H*.84,a,20);edge(-W*.4,-H*.36,W*.8,H*.72,ink+'60',14);circle(W*.32,-H*.29,8,dark);icon(0,-H*.16,H*.24,ink);text(title,0,H*.1,H*.11,ink,W*.72,'center',800);text(sub,0,H*.28,H*.06,ink,W*.72,'center');ctx.restore();}
      else{panel();box(W*.07,H*.1,W*.86,H*.38,v%4===1?ink+'10':a+'20',15);icon(W*.5,H*.29,H*.28,panelInk);text(title,W*.08,H*.61,H*.095,panelInk,W*.84);text(sub,W*.08,H*.8,H*.075,panelSub,W*.84);stroke([W*.81,H*.91,W*.91,H*.91,W*.91,H*.82],panelInk,2);}break;
    }
    case 'events': {
      if(v===2||v===9){edge(10,10,W-20,H-20,a,Math.min(W,H)*.35,2);icon(W*.5,H*.22,H*.18);text(title,W*.5,H*.5,H*.12,white,W*.8,'center',600,'playfair');text(sub,W*.5,H*.72,H*.065,a,W*.78,'center');circle(W*.5,H*.88,3+phase*2,a);}
      else{panel();box(W*.05,H*.09,W*.2,H*.42,v%4===1?dark:a,12);icon(W*.15,H*.3,H*.21,v%4===1?a:ink);stroke([W*.3,H*.2,W*.88,H*.2],panelSub+'50',1);text(title,W*.3,H*.39,H*.095,panelInk,W*.62);ctx.save();ctx.setLineDash([3,7]);stroke([W*.06,H*.64,W*.94,H*.64],panelInk+'60',1);ctx.restore();text(sub,W*.07,H*.82,H*.08,panelInk,W*.86);}break;
    }
    case 'reactions': {
      ctx.save();ctx.translate(W/2,H*.44);ctx.rotate(Math.sin(seconds*1.2+v)*.035);ctx.shadowColor='#00000045';ctx.shadowBlur=20;ctx.shadowOffsetY=14;
      if(v%3===0){ctx.fillStyle=gradient(a,'#F4F1FF');ctx.beginPath();ctx.roundRect(-u*.33,-u*.32,u*.66,u*.64,u*.22);ctx.fill();}
      else if(v%3===1){ctx.beginPath();for(let i=0;i<24;i++){const angle=i/24*Math.PI*2,r=u*(i%2?.33:.37);if(!i)ctx.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);else ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);}ctx.closePath();ctx.fillStyle=a;ctx.fill();}
      else{ctx.rotate(-.1);box(-u*.37,-u*.29,u*.74,u*.58,a,u*.12);}
      ctx.shadowBlur=0;ctx.shadowOffsetY=0;drawPresetIcon(ctx,p.icon,3,6,u*.39,ink,true);drawPresetIcon(ctx,p.icon,0,0,u*.39,ink);ctx.restore();
      chip(title,W*.07,H*.82,W*.86,H*.14,dark);break;
    }
    case 'badges': {
      ctx.save();ctx.translate(W/2,H*.45);const r=u*.36;
      if(v%2===0){ctx.beginPath();for(let i=0;i<48;i++){const angle=i/48*Math.PI*2,rr=r*(i%2?.92:1);if(!i)ctx.moveTo(Math.cos(angle)*rr,Math.sin(angle)*rr);else ctx.lineTo(Math.cos(angle)*rr,Math.sin(angle)*rr);}ctx.closePath();ctx.fillStyle=a;ctx.fill();}
      else{box(-r,-r,r*2,r*2,a,r*.25);}
      ctx.strokeStyle=ink+'60';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*.82,0,Math.PI*2);ctx.stroke();drawPresetIcon(ctx,p.icon,0,-r*.16,r*.86,ink,true);stroke([-r*.35,r*.54,r*.35,r*.54],ink+'60',1);ctx.restore();
      box(W*.05,H*.79,W*.9,H*.15,dark,7);text(title,W*.5,H*.865,H*.047,a,W*.83,'center',700);break;
    }
    case 'data': {
      panel();text(v===1||v===9?'':title,W*.07,H*.2,H*.09,panelInk,W*.72);icon(W*.89,H*.19,H*.14,panelInk);
      if(v===1||v===9){text(title,W*.07,H*.51,H*.31,panelInk,W*.6,'left',800,'space-grotesk');for(let i=0;i<4;i++)circle(W*(.72+i*.05),H*.53,H*.055,i===3?a:panelInk+'30');}
      else if(v===3||v===4){const x=W*.22,y=H*.52,r=H*.2;ctx.lineWidth=H*.07;ctx.strokeStyle=panelInk+'22';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=panelInk;ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,Math.PI*.85);ctx.stroke();icon(W*.65,H*.53,H*.22,panelInk);}
      else if(v===2||v===5){for(let i=0;i<9;i++){const bh=H*(.1+((i*7+v)%10)/10*.3);box(W*.07+i*W*.095,H*.72-bh,W*.055,bh,i===8?panelInk:panelInk+'55',4);}}
      else if(v===6){for(let i=0;i<5;i++)drawPresetIcon(ctx,'star',W*(.15+i*.17),H*.51,H*.18,i<Math.min(e.behavior?.countFrom??5,completedItems(e,seconds,5))?panelInk:panelInk+'40',true);}
      else trace(W*.08,H*.32,W*.84,H*.4,panelInk);
      text(sub,W*.07,H*.89,H*.07,panelSub,W*.86);break;
    }
    case 'callouts': {
      const cx=W*.08,cy=H*.82;circle(cx,cy,H*.065,a+'30');circle(cx,cy,H*.027,a);ctx.save();ctx.globalAlpha*=.2+phase*.3;ctx.strokeStyle=a;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,H*(.08+phase*.04),0,Math.PI*2);ctx.stroke();ctx.restore();stroke([cx,cy,W*.26,H*.28,W*.34,H*.28],a,2);
      box(W*.3,H*.07,W*.68,H*.69,v%2===0?dark:a,15);icon(W*.4,H*.27,H*.18,v%2===0?a:ink);text(title,W*.49,H*.27,H*.09,v%2===0?white:ink,W*.43);text(sub,W*.36,H*.55,H*.09,v%2===0?muted:ink,W*.56);break;
    }
    case 'end-screens': {
      if(v===9){icon(W*.5,H*.22,H*.1);text(title,W*.5,H*.47,H*.11,white,W*.9,'center',500,'playfair');text(sub,W*.5,H*.65,H*.05,a,W*.87,'center',400);stroke([W*.38,H*.8,W*.62,H*.8],a,1);break;}
      icon(W*.5,H*.08,H*.09);text(title,W*.5,H*.21,H*.09,white,W*.9,'center',700,v===9?'playfair':'inter');text(sub,W*.5,H*.34,H*.047,a,W*.87,'center',400);
      if(v===2||v===8){circle(W*.19,H*.69,H*.18,'#FFFFFF08');ctx.strokeStyle=a;ctx.lineWidth=2;ctx.beginPath();ctx.arc(W*.19,H*.69,H*.18,0,Math.PI*2);ctx.stroke();edge(W*.4,H*.47,W*.56,H*.46,a,15,2);}
      else if(v===1){edge(W*.15,H*.45,W*.7,H*.48,a,16,2);}
      else if(v===3){edge(W*.04,H*.45,W*.55,H*.48,a,14,2);for(let i=0;i<2;i++)edge(W*.64,H*(.45+i*.26),W*.32,H*.22,a,10,1.5);}
      else if(v===5){for(let i=0;i<2;i++){ctx.save();ctx.translate(W*(.26+i*.48),H*.7);ctx.rotate(i===0?-.045:.045);edge(-W*.21,-H*.22,W*.42,H*.44,a,12,2);ctx.restore();}}
      else if(v===6){for(let i=0;i<2;i++)edge(W*(.035+i*.64),H*.48,W*.29,H*.4,a,12,1.5);ctx.strokeStyle=a;ctx.lineWidth=2;ctx.beginPath();ctx.arc(W*.5,H*.68,H*.14,0,Math.PI*2);ctx.stroke();}
      else if(v===7){edge(W*.1,H*.44,W*.8,H*.3,a,12,1.8);for(let i=0;i<3;i++)edge(W*(.15+i*.25),H*.79,W*.2,H*.16,a,8,1.2);}
      else{for(let i=0;i<2;i++){const left=W*(.035+i*.49);edge(left,H*.45,W*.44,H*.48,a,14,1.8);box(left+12,H*.45+12,22,4,a,2);}}
      break;
    }
    case 'stories': {
      if(v===1||v===3){box(10,10,W-20,H-20,v===1?'#EDE9DF':a,18);text('“',W*.1,H*.25,H*.3,v===1?a:ink,W*.3,'left',600,'playfair');text(sub,W*.12,H*.55,H*.11,dark,W*.76,'left',500,'playfair');text(title,W*.12,H*.84,H*.043,'#5B6272',W*.76);}
      else if(v===8){box(5,5,W-10,H-10,'#EEECE3',12);edge(W*.77,H*.07,W*.14,H*.19,dark,0);icon(W*.84,H*.165,H*.11,dark);stroke([W*.63,H*.1,W*.63,H*.87],'#5B627255',1);text(title,W*.07,H*.29,H*.075,dark,W*.51);text(sub,W*.07,H*.56,H*.095,dark,W*.5,'left',500,'playfair');stroke([W*.07,H*.86,W*.4,H*.86],'#5B627255',1);}
      else{panel();icon(W*.14,H*.21,H*.15,panelInk);text(title,W*.08,H*.45,H*.085,panelInk,W*.84);text(sub,W*.08,H*.7,H*.095,panelInk,W*.84,'left',500,v===9?'caveat':'playfair');stroke([W*.08,H*.87,W*(.32+phase*.15),H*.87],panelInk,2);}break;
    }
  }
  ctx.restore();return true;
}
