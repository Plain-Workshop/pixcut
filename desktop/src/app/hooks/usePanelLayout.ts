import { useState } from 'react';
import { clampZoom, MIN_TIMELINE_ZOOM } from '../../components/timeline/ruler';

/** Hard ceiling for stored zoom; the panel narrows it to one frame per 16 px for the open story. */
const STORED_ZOOM_LIMIT = 5000;

/** Persisted panel sizes, timeline zoom and collapsed lanes, plus the splitter drag that resizes the panels. */
export function usePanelLayout() {
  const [layout, setLayout] = useState(() => { try { return JSON.parse(localStorage.getItem('pixcut-layout') || '{}'); } catch { return {}; } });
  const libraryWidth = layout.libraryWidth ?? 280, inspectorWidth = layout.inspectorWidth ?? 288, timelineHeight = layout.timelineHeight ?? 340;
  const timelineZoom = Math.min(STORED_ZOOM_LIMIT, Math.max(MIN_TIMELINE_ZOOM, Number(layout.timelineZoom) || 1));
  const collapsedLanes: string[] = Array.isArray(layout.collapsedLanes) ? layout.collapsedLanes.filter((id: unknown): id is string => typeof id === 'string') : [];

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

  function persist(patch: Record<string, unknown>) {
    setLayout((current: any) => {
      const updated = { ...current, ...patch };
      try { localStorage.setItem('pixcut-layout', JSON.stringify(updated)); } catch { /* optional */ }
      return updated;
    });
  }

  function changeTimelineZoom(value: number) {
    persist({ timelineZoom: clampZoom(value, STORED_ZOOM_LIMIT) });
  }

  function setCollapsedLanes(ids: string[]) {
    persist({ collapsedLanes: [...new Set(ids)] });
  }

  function toggleLane(id: string) {
    setCollapsedLanes(collapsedLanes.includes(id) ? collapsedLanes.filter(lane => lane !== id) : [...collapsedLanes, id]);
  }

  return { setLayout, libraryWidth, inspectorWidth, timelineHeight, timelineZoom, beginResize, changeTimelineZoom, collapsedLanes, toggleLane, setCollapsedLanes };
}
