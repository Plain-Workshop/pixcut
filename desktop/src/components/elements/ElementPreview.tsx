import { defaultElementSize } from './geometry';
import { isDynamicElement, isCardElement } from './dynamic';
import { isModernElement } from './modern';
import { useEffect, useRef } from 'react';
import { elementMotion } from './motion';
import { drawElementOverlay } from '../preview/render';
import type { ElementKind, ElementLayer, Scene } from '../../stores/model';

export function ElementPreview({ kind, color, animation = 'none', label, reduceMotion = false }: { kind: ElementKind; color: string; animation?: ElementLayer['animation']; label?: string; reduceMotion?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const size = defaultElementSize(kind, { width: 240, height: 160 });
    const ratio = size.height / size.width;
    const modernWidth = Math.min(.84, .7 / ratio);
    const scene: Scene = {
      id: 'preview', name: '', image: '', startTicks: 0, sourceInTicks: 0, durationTicks: 300,
      title: '', subtitle: '', color, fit: 'cover',
      elements: [{ id: 'preview', kind, label, x: .5, y: .5, width: (isModernElement(kind) || isCardElement(kind)) ? modernWidth : .78, height: (isModernElement(kind) || isCardElement(kind)) ? modernWidth * ratio : ['line', 'underline', 'progress'].includes(kind) ? .08 : ['subscribe', 'like'].includes(kind) ? .38 : .66, rotation: 0, color, opacity: 100, startTicks: 0, durationTicks: 300, animation }],
    };
    const target = canvas.current;
    if (!target) return;
    let raf = 0, visible = false, previous = 0, start = 0;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (seconds: number) => {
      const motion = elementMotion(animation, seconds);
      // Exaggerate translation in these tiny thumbnails so the direction is legible.
      scene.elements![0].x = .5 + motion.x * 2;
      scene.elements![0].y = .5 + motion.y * 2;
      void drawElementOverlay(target, scene, 'preview', seconds, '16:9', undefined, { width: 240, height: 160 }, [], true); };
    const animate = (now: number) => {
      if (!visible || reduceMotion || media.matches || (animation === 'none' && !isDynamicElement(kind))) return;
      if (!start) start = now;
      if (now - previous > 65) { draw(isDynamicElement(kind) ? ((now - start) / 1000) % 7 : animation === 'pulse' || animation === 'float' || animation === 'swing' ? (now - start) / 1000 : ((1 - Math.cos((now - start) / 1000 * Math.PI / .6)) / 2) * .6); previous = now; }
      raf = requestAnimationFrame(animate);
    };
    const restart = () => { cancelAnimationFrame(raf); draw(.35); if (visible) { start = 0; raf = requestAnimationFrame(animate); } };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; restart(); });
    draw(.35); observer.observe(target); media.addEventListener('change', restart);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); media.removeEventListener('change', restart); };
  }, [kind, color, animation, label, reduceMotion]);
  return <canvas ref={canvas} aria-hidden="true" />;
}
