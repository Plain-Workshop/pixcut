import { useRef, useState, type ReactNode } from 'react';
import { loadProjectFrames, type ProjectSummary } from '../stores/library';

/** A project card preview that scrubs through the project's scenes while the pointer moves over it. */
export function ProjectThumb({ entry, children }: { entry: ProjectSummary; children: ReactNode }) {
  const [frames, setFrames] = useState<string[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const requested = useRef(false);
  const load = () => {
    if (requested.current) return;
    requested.current = true;
    void loadProjectFrames(entry.id).then(setFrames).catch(() => { requested.current = false; });
  };
  const move = (event: React.PointerEvent<HTMLElement>) => {
    load();
    if (frames.length < 2) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(.999, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width)));
    setIndex(Math.floor(ratio * frames.length));
  };
  const showing = index !== null && frames[index];
  return <div className="project-thumb" onPointerEnter={load} onPointerMove={move} onPointerLeave={() => { setIndex(null); requested.current = frames.length > 0; }}>
    {children}
    {showing && <img className="project-scrub" src={frames[index]} alt="" />}
    {showing && <span className="project-scrub-bar" aria-hidden="true"><span style={{ width: `${((index + 1) / frames.length) * 100}%` }} /></span>}
  </div>;
}
