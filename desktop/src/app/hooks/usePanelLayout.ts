import { useState } from 'react';

/** Persisted panel sizes and timeline zoom, plus the splitter drag that resizes the panels. */
export function usePanelLayout() {
  const [layout, setLayout] = useState(() => { try { return JSON.parse(localStorage.getItem('pixcut-layout') || '{}'); } catch { return {}; } });
  const libraryWidth = layout.libraryWidth ?? 280, inspectorWidth = layout.inspectorWidth ?? 288, timelineHeight = layout.timelineHeight ?? 340;
  const timelineZoom = Math.min(6, Math.max(.5, Number(layout.timelineZoom) || 1));

  function beginResize(kind: 'library' | 'inspector' | 'timeline', start: number, coord: number) {
    const onMove = (e: PointerEvent) => {
      setLayout((l: any) => {
        if (kind === 'library') return { ...l, libraryWidth: Math.min(380, Math.max(220, start + (e.clientX - coord))) };
        if (kind === 'inspector') return { ...l, inspectorWidth: Math.min(380, Math.max(220, start + (coord - e.clientX))) };
        return { ...l, timelineHeight: Math.min(460, Math.max(230, start + (coord - e.clientY))) };
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setLayout((l: any) => { try { localStorage.setItem('pixcut-layout', JSON.stringify(l)); } catch {} return l; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function changeTimelineZoom(value: number) {
    const next = Math.min(6, Math.max(.5, Math.round(value * 4) / 4));
    setLayout((current: any) => {
      const updated = { ...current, timelineZoom: next };
      try { localStorage.setItem('pixcut-layout', JSON.stringify(updated)); } catch { /* optional */ }
      return updated;
    });
  }

  return { setLayout, libraryWidth, inspectorWidth, timelineHeight, timelineZoom, beginResize, changeTimelineZoom };
}
