import { useEffect, useRef } from 'react';
import type { TransitionType } from '../../stores/model';
import { drawTransitionFrames } from './transitions';

function sampleFrame(second: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 192; canvas.height = 108;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = second ? '#D4EAB5' : '#C4B5F5';
  ctx.fillRect(0, 0, 192, 108);
  ctx.fillStyle = second ? '#F29B53' : '#F8E7A2';
  ctx.beginPath(); ctx.arc(second ? 143 : 47, 34, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = second ? '#376556' : '#6754A4';
  ctx.beginPath(); ctx.moveTo(0, 108); ctx.lineTo(second ? 48 : 132, 42);
  ctx.lineTo(192, 108); ctx.fill();
  ctx.fillStyle = second ? '#23463B' : '#3D3267';
  ctx.font = 'bold 20px sans-serif'; ctx.fillText(second ? 'B' : 'A', 12, 28);
  return canvas;
}

export function TransitionPreview({ type, reduceMotion = false, active = false }: { type: TransitionType; reduceMotion?: boolean; active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const from = sampleFrame(false), to = sampleFrame(true);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, visible = false, start = 0, last = 0;
    const draw = (p: number) => {
      if (type === 'none') {
        canvas.width = from.width; canvas.height = from.height;
        // “None” is a hard cut, so the sample intentionally remains still.
        canvas.getContext('2d')?.drawImage(from, 0, 0);
      } else drawTransitionFrames(canvas, from, to, type, p);
    };
    const animate = (now: number) => {
      if (!active || !visible || document.hidden || reduceMotion || media.matches) return;
      if (!start) start = now;
      if (now - last >= 40) {
        // A brief view of each scene makes the direction of the transition clear.
        const phase = ((now - start) / 1000) % 1.8;
        draw(Math.min(1, Math.max(0, (phase - .2) / 1.2)));
        last = now;
      }
      raf = requestAnimationFrame(animate);
    };
    const restart = () => {
      cancelAnimationFrame(raf); start = 0; last = 0;
      draw(reduceMotion || media.matches ? .5 : 0);
      if (active && visible && !document.hidden && !reduceMotion && !media.matches) raf = requestAnimationFrame(animate);
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; restart(); });
    observer.observe(canvas); restart();
    media.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); media.removeEventListener('change', restart); document.removeEventListener('visibilitychange', restart); };
  }, [type, reduceMotion, active]);
  return <canvas className="transition-example" ref={ref} data-transition={type} aria-hidden="true" />;
}
