export type TemplateKind = 'travel' | 'family' | 'birthday' | 'product' | 'social';

const cache = new Map<string, string>();

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function grain(ctx: CanvasRenderingContext2D, seed: number, alpha: number) {
  const size = 256;
  const image = ctx.createImageData(size, size);
  const next = random(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.floor(next() * 255);
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = Math.floor(alpha * 255);
  }
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  tile.getContext('2d')!.putImageData(image, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, 1600, 1600);
  ctx.restore();
}

function travel(ctx: CanvasRenderingContext2D, index: number) {
  const shift = index * 130;
  const sky = ctx.createLinearGradient(0, 0, 0, 1600);
  sky.addColorStop(0, '#F6D6AE');
  sky.addColorStop(0.38, '#D8B89E');
  sky.addColorStop(0.68, '#95A9B4');
  sky.addColorStop(1, '#536A78');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1600, 1600);

  const glow = ctx.createRadialGradient(1080 - shift * 0.4, 420, 20, 1080 - shift * 0.4, 420, 420);
  glow.addColorStop(0, 'rgba(255, 238, 192, .95)');
  glow.addColorStop(0.35, 'rgba(255, 211, 148, .42)');
  glow.addColorStop(1, 'rgba(255, 200, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1600, 1200);
  ctx.fillStyle = '#FFF0C9';
  ctx.beginPath();
  ctx.arc(1080 - shift * 0.4, 420, 78, 0, Math.PI * 2);
  ctx.fill();

  const ridge = (base: number, amplitude: number, color: string, offset: number) => {
    ctx.beginPath();
    ctx.moveTo(0, 1600);
    for (let x = 0; x <= 1600; x += 20) {
      const y = base
        + Math.sin((x + offset) / 260) * amplitude
        + Math.cos((x + offset) / 109) * amplitude * 0.22
        - Math.sin((x + offset) / 620) * amplitude * 0.62;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(1600, 1600);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(1030, 92, '#7C909B', shift);
  ridge(1130, 120, '#5E747F', shift + 270);
  ridge(1260, 150, '#3D5661', shift + 520);
  ridge(1410, 120, '#243E49', shift + 760);
  ctx.fillStyle = '#152A36';
  ctx.fillRect(0, 1490, 1600, 110);

  ctx.strokeStyle = 'rgba(30, 45, 55, .42)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const x = 300 + i * 63 + (index % 2) * 40;
    const y = 470 + (i % 3) * 31;
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.quadraticCurveTo(x, y - 10, x + 14, y);
    ctx.stroke();
  }
  grain(ctx, 11 + index, .12);
}

function family(ctx: CanvasRenderingContext2D, index: number) {
  const wall = ctx.createLinearGradient(0, 0, 1600, 1600);
  wall.addColorStop(0, '#F8EEE2');
  wall.addColorStop(0.55, '#EAD4C2');
  wall.addColorStop(1, '#D3AF9B');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 1600, 1600);

  ctx.save();
  ctx.globalAlpha = .55;
  ctx.fillStyle = '#D89A73';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(760, 0);
  ctx.lineTo(270, 1600);
  ctx.lineTo(0, 1600);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const archX = 740 + index * 42;
  ctx.save();
  rounded(ctx, archX, 210, 560, 1010, 280);
  ctx.clip();
  const window = ctx.createLinearGradient(archX, 210, archX, 1220);
  window.addColorStop(0, '#FFF3C9');
  window.addColorStop(.55, '#F2C48D');
  window.addColorStop(1, '#D08A61');
  ctx.fillStyle = window;
  ctx.fillRect(archX, 210, 560, 1010);
  ctx.fillStyle = 'rgba(255, 248, 220, .55)';
  ctx.beginPath();
  ctx.arc(archX + 210, 560, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(126, 82, 64, .24)';
  ctx.lineWidth = 8;
  rounded(ctx, archX, 210, 560, 1010, 280);
  ctx.stroke();

  const frames = [
    { x: 140, y: 310, w: 310, h: 390, r: -7, tint: '#C9856C' },
    { x: 220, y: 810, w: 280, h: 330, r: 5, tint: '#8C5A54' },
    { x: 560, y: 1130, w: 250, h: 300, r: -4, tint: '#B36F63' },
  ];
  for (const [i, frame] of frames.entries()) {
    ctx.save();
    ctx.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
    ctx.rotate((frame.r * Math.PI) / 180);
    ctx.shadowColor = 'rgba(70, 40, 34, .22)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#FBF4E8';
    rounded(ctx, -frame.w / 2, -frame.h / 2, frame.w, frame.h, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    const photo = ctx.createLinearGradient(0, -frame.h / 2, 0, frame.h / 2);
    photo.addColorStop(0, frame.tint);
    photo.addColorStop(1, i === 1 ? '#5A3C3C' : '#7E4D45');
    ctx.fillStyle = photo;
    rounded(ctx, -frame.w / 2 + 18, -frame.h / 2 + 18, frame.w - 36, frame.h - 68, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 234, 208, .66)';
    ctx.beginPath();
    ctx.arc(0, -frame.h / 2 + frame.h * .34, frame.w * .16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 234, 208, .42)';
    ctx.beginPath();
    ctx.ellipse(0, -frame.h / 2 + frame.h * .62, frame.w * .25, frame.h * .18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(110, 67, 53, .22)';
  ctx.beginPath();
  ctx.ellipse(1120, 1435, 310, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8D5A4A';
  rounded(ctx, 1135, 1180, 190, 245, 26);
  ctx.fill();
  ctx.fillStyle = '#A36C58';
  rounded(ctx, 1108, 1162, 244, 52, 22);
  ctx.fill();
  ctx.strokeStyle = '#8D5A4A';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(1230, 1160);
  ctx.bezierCurveTo(1260, 1030, 1370, 1060, 1380, 930);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 246, 226, .72)';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.ellipse(1250 + Math.cos(i * 1.8) * 85, 900 + Math.sin(i * 1.4) * 95, 24, 11, i, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, 23 + index, .11);
}

function birthday(ctx: CanvasRenderingContext2D, index: number) {
  const backdrop = ctx.createRadialGradient(860, 620, 60, 820, 740, 1200);
  backdrop.addColorStop(0, '#5D265F');
  backdrop.addColorStop(.48, '#3C1A4A');
  backdrop.addColorStop(1, '#140D27');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, 1600, 1600);

  const next = random(41 + index);
  const palette = [['#FFC96B', '#FF7AA8', '#B58CFF'], ['#7FE7FF', '#FF8DC7', '#FFD166'], ['#FFD166', '#FF6B9F', '#8F7CFF']][index % 3];
  for (let i = 0; i < 85; i++) {
    const x = next() * 1600;
    const y = next() * 1500;
    const w = 8 + next() * 18;
    const h = 3 + next() * 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(next() * Math.PI);
    ctx.globalAlpha = .55 + next() * .4;
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  const balloons = [
    { x: 300, y: 450, rx: 120, ry: 150, color: palette[0] },
    { x: 530, y: 300, rx: 92, ry: 118, color: palette[1] },
    { x: 700, y: 520, rx: 76, ry: 98, color: palette[2] },
    { x: 1310, y: 380, rx: 105, ry: 132, color: palette[1] },
    { x: 1190, y: 560, rx: 70, ry: 90, color: palette[0] },
  ];
  for (const balloon of balloons) {
    const gradient = ctx.createLinearGradient(balloon.x - balloon.rx, balloon.y - balloon.ry, balloon.x + balloon.rx, balloon.y + balloon.ry);
    gradient.addColorStop(0, balloon.color);
    gradient.addColorStop(1, '#5A235D');
    ctx.save();
    ctx.globalAlpha = .92;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(balloon.x, balloon.y, balloon.rx, balloon.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 220, .42)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(balloon.x, balloon.y + balloon.ry);
    ctx.bezierCurveTo(balloon.x - 24, balloon.y + balloon.ry + 150, balloon.x + 30, balloon.y + balloon.ry + 280, balloon.x - 10, balloon.y + balloon.ry + 420);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, .4)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = '#F6E8D8';
  rounded(ctx, 1050, 1150, 360, 180, 22);
  ctx.fill();
  ctx.fillStyle = '#F0A6B9';
  rounded(ctx, 1090, 1070, 280, 110, 18);
  ctx.fill();
  ctx.fillStyle = '#FFF6EA';
  rounded(ctx, 1040, 1280, 380, 42, 12);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#FFD166';
  for (let i = 0; i < 3; i++) {
    const x = 1140 + i * 90;
    ctx.fillRect(x, 985, 8, 88);
    ctx.fillStyle = '#FF8DA6';
    ctx.beginPath();
    ctx.ellipse(x + 4, 975, 9, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFD166';
  }
  ctx.fillStyle = 'rgba(255, 255, 255, .16)';
  ctx.beginPath();
  ctx.ellipse(1230, 1360, 300, 55, 0, 0, Math.PI * 2);
  ctx.fill();
  grain(ctx, 61 + index, .14);
}

function product(ctx: CanvasRenderingContext2D, index: number) {
  const room = ctx.createLinearGradient(0, 0, 1600, 1600);
  room.addColorStop(0, '#F5EDE3');
  room.addColorStop(.5, '#E4D5C4');
  room.addColorStop(1, '#C9B39E');
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, 1600, 1600);

  const halo = ctx.createRadialGradient(800, 720, 40, 800, 780, 640);
  halo.addColorStop(0, 'rgba(255, 252, 244, .95)');
  halo.addColorStop(.5, 'rgba(255, 246, 232, .55)');
  halo.addColorStop(1, 'rgba(255, 246, 232, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 1600, 1600);

  ctx.fillStyle = 'rgba(90, 68, 54, .18)';
  ctx.beginPath();
  ctx.ellipse(820, 1270, 380, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  const pedestal = ctx.createLinearGradient(500, 0, 1100, 0);
  pedestal.addColorStop(0, '#CDB8A4');
  pedestal.addColorStop(.45, '#F0E3D5');
  pedestal.addColorStop(1, '#BFA58D');
  ctx.fillStyle = pedestal;
  ctx.fillRect(540, 1050, 520, 220);
  ctx.fillStyle = '#E7D8C8';
  ctx.beginPath();
  ctx.ellipse(800, 1050, 260, 54, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(110, 82, 62, .22)';
  ctx.beginPath();
  ctx.ellipse(800, 1270, 260, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  if (index % 3 === 0) {
    const bottle = ctx.createLinearGradient(640, 0, 960, 0);
    bottle.addColorStop(0, '#1A2438');
    bottle.addColorStop(.5, '#384B67');
    bottle.addColorStop(1, '#131C2E');
    ctx.fillStyle = bottle;
    rounded(ctx, 680, 470, 240, 590, 42);
    ctx.fill();
    ctx.fillStyle = '#1A2133';
    rounded(ctx, 735, 390, 130, 110, 18);
    ctx.fill();
    ctx.fillStyle = '#D8B978';
    rounded(ctx, 720, 350, 160, 62, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 239, 208, .92)';
    rounded(ctx, 714, 680, 172, 170, 10);
    ctx.fill();
    ctx.fillStyle = '#1A2438';
    ctx.font = '600 23px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIXCUT', 800, 748);
    ctx.font = '400 15px Inter, sans-serif';
    ctx.fillText('DAILY ESSENTIAL', 800, 782);
    ctx.fillStyle = 'rgba(255, 255, 255, .2)';
    rounded(ctx, 706, 500, 28, 430, 14);
    ctx.fill();
  } else if (index % 3 === 1) {
    ctx.save();
    ctx.translate(800, 820);
    ctx.rotate(-.04);
    const box = ctx.createLinearGradient(-210, -260, 210, 260);
    box.addColorStop(0, '#F8F1E6');
    box.addColorStop(.55, '#E6D3BE');
    box.addColorStop(1, '#CBB39B');
    ctx.fillStyle = box;
    rounded(ctx, -230, -280, 460, 560, 20);
    ctx.fill();
    ctx.fillStyle = '#243149';
    rounded(ctx, -230, -280, 460, 82, 18);
    ctx.fill();
    ctx.fillStyle = '#D8B978';
    rounded(ctx, -52, -420, 104, 58, 12);
    ctx.fill();
    ctx.fillStyle = '#243149';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIXCUT', 0, -70);
    ctx.font = '400 17px Inter, sans-serif';
    ctx.fillText('THE EVERYDAY OBJECT', 0, -32);
    ctx.strokeStyle = 'rgba(36, 49, 73, .35)';
    ctx.lineWidth = 2;
    rounded(ctx, -160, 20, 320, 160, 10);
    ctx.stroke();
    ctx.restore();
  } else {
    const jar = ctx.createLinearGradient(660, 0, 940, 0);
    jar.addColorStop(0, '#B9A48D');
    jar.addColorStop(.5, '#F0E2D0');
    jar.addColorStop(1, '#A88F77');
    ctx.fillStyle = jar;
    rounded(ctx, 660, 620, 280, 440, 60);
    ctx.fill();
    ctx.fillStyle = '#2A3141';
    rounded(ctx, 634, 580, 332, 82, 18);
    ctx.fill();
    ctx.fillStyle = '#D8B978';
    rounded(ctx, 682, 790, 236, 130, 10);
    ctx.fill();
    ctx.fillStyle = '#2A3141';
    ctx.font = '600 26px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIXCUT', 800, 846);
    ctx.font = '400 15px Inter, sans-serif';
    ctx.fillText('NATURAL FINISH', 800, 878);
    ctx.fillStyle = 'rgba(255, 255, 255, .32)';
    rounded(ctx, 688, 650, 24, 360, 12);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 250, 243, .35)';
  ctx.beginPath();
  ctx.arc(1210, 370, 130, 0, Math.PI * 2);
  ctx.fill();
  grain(ctx, 83 + index, .08);
}

function social(ctx: CanvasRenderingContext2D, index: number) {
  const palettes = [
    ['#FF6B6B', '#C13AA0', '#5B3DF5'],
    ['#FFB347', '#FF5E7E', '#8B3DFF'],
    ['#38E8C8', '#5C7CFF', '#B24BFF'],
  ];
  const palette = palettes[index % palettes.length];
  const gradient = ctx.createLinearGradient(0, 0, 1600, 1600);
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(.55, palette[1]);
  gradient.addColorStop(1, palette[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1600, 1600);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255, 255, 255, .18)';
  ctx.beginPath();
  ctx.arc(420 + index * 80, 480, 340, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, .34)';
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.arc(1120, 920, 380, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(800, 800);
  ctx.rotate(-.28);
  ctx.strokeStyle = 'rgba(18, 8, 40, .3)';
  ctx.lineWidth = 70;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-1200, i * 190);
    ctx.lineTo(1200, i * 190 - 320);
    ctx.stroke();
  }
  ctx.restore();

  const next = random(107 + index);
  for (let i = 0; i < 120; i++) {
    const x = next() * 1600;
    const y = next() * 1600;
    ctx.globalAlpha = .35 + next() * .5;
    ctx.fillStyle = i % 4 === 0 ? '#FFFFFF' : palette[i % palette.length];
    ctx.beginPath();
    ctx.arc(x, y, 1 + next() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  grain(ctx, 131 + index, .12);
}

export function templateArt(kind: TemplateKind, index: number): string {
  const key = `${kind}-${index}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d')!;
  if (kind === 'travel') travel(ctx, index);
  else if (kind === 'family') family(ctx, index);
  else if (kind === 'birthday') birthday(ctx, index);
  else if (kind === 'product') product(ctx, index);
  else social(ctx, index);
  const image = canvas.toDataURL('image/jpeg', .9);
  cache.set(key, image);
  if (cache.size > 24) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return image;
}
