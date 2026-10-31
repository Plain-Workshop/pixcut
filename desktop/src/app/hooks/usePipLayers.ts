import { t } from '../../i18n';
import { landedOn, setSnapGuide, snapEdges, snapThreshold, timelineSnapPoints } from '../../components/timeline/timeline-snap';
import { constrainPipTiming, freePipStart, pipSourceRoom } from '../../components/timeline/pip';
import { resolveMediaSource } from '../../components/preview/media-url';
import { type PointerEvent as ReactPointerEvent } from 'react';
import { overlayScenes, minTicks, secondsToTicks, ticksToSeconds, type Command, type Project, type Scene } from '../../stores/model';
import { loadImage } from '../../components/preview/render';
import { probeVideo } from '../../components/preview/video';
import { messageFor } from '../errors';
import { captureDragPointer } from '../helpers';
import { type Dispatch, type SetStateAction, type RefObject } from 'react';

export function usePipLayers({ timelineSnapping, setSelectedPipId, setSelectedIds, setPrimarySelected, selectionAnchor, setSelectedTextLayerId, setSelectedGlobalTextId, setSelectedElementId, setEditTarget, setEditingText, setFramingMode, setPlaying, setPosition, project, selectedPip, pipDraftRef, setPipDraft, activePip, setError, run, setNotice, canEdit, projectTicks, selectedScene, position, activeSize }: {
  setSelectedPipId: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  selectionAnchor: RefObject<string | null>;
  setSelectedTextLayerId: Dispatch<SetStateAction<string | null>>;
  setSelectedGlobalTextId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setEditTarget: Dispatch<SetStateAction<"scene" | "text" | "element" | "audio">>;
  setEditingText: Dispatch<SetStateAction<boolean>>;
  setFramingMode: Dispatch<SetStateAction<boolean>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setPosition: Dispatch<SetStateAction<number>>;
  project: Project;
  selectedPip: Scene | null;
  pipDraftRef: RefObject<Scene | null>;
  setPipDraft: Dispatch<SetStateAction<Scene | null>>;
  activePip: Scene | null;
  setError: Dispatch<SetStateAction<string>>;
  run: (command: Command) => Promise<boolean>;
  setNotice: Dispatch<SetStateAction<string>>;
  canEdit: boolean;
  projectTicks: number;
  selectedScene: Scene | undefined;
  position: number;
  timelineSnapping: boolean;
  activeSize: { width: number; height: number; };
}) {
  function selectPip(clip: Scene) {
    setSelectedPipId(clip.id);
    setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null;
    setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedElementId(null);
    setEditTarget('scene'); setEditingText(false); setFramingMode(false); setPlaying(false);
    setPosition(ticksToSeconds(clip.startTicks, project.timebase));
  }

  function stagePip(patch: Partial<Scene>) {
    if (!selectedPip) return;
    const base = pipDraftRef.current?.id === selectedPip.id ? pipDraftRef.current : selectedPip;
    const next = { ...base, ...patch };
    pipDraftRef.current = next;
    setPipDraft(next);
  }

  function stagePipStyle(key: 'x' | 'y' | 'width' | 'height' | 'radius' | 'shadow', value: number) {
    if (!activePip?.pip) return;
    stagePip({ pip: { ...activePip.pip, [key]: value } });
  }

  function commitPip() {
    const draft = pipDraftRef.current;
    pipDraftRef.current = null;
    setPipDraft(null);
    if (!draft) return;
    if (draft.pip && (![draft.pip.x, draft.pip.y, draft.pip.width, draft.pip.height, draft.pip.radius, draft.pip.shadow].every(Number.isFinite))) {
      setError(t('Picture-in-picture placement is invalid.'));
      return;
    }
    void run({ type: 'pip', scenes: overlayScenes(project).map(clip => clip.id === draft.id ? draft : clip) });
  }

  function removePip(id: string) {
    void run({ type: 'pip', scenes: overlayScenes(project).filter(clip => clip.id !== id) }).then(ok => {
      if (ok) { setSelectedPipId(null); setPipDraft(null); pipDraftRef.current = null; setNotice(t('Picture-in-picture clip removed.')); }
    });
  }

  function beginPipTiming(event: ReactPointerEvent<HTMLElement>, clip: Scene, edge: 'move' | 'start' | 'end') {
    if (!canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); captureDragPointer(event); selectPip(clip);
    const track = event.currentTarget.closest('.pip-track')?.getBoundingClientRect();
    if (!track?.width) return;
    const startX = event.clientX;
    let moved = false;
    const points = timelineSnapping ? timelineSnapPoints(project, secondsToTicks(position, project.timebase), clip.id) : [];
    const threshold = snapThreshold(projectTicks, track.width);
    const constrain = (delta: number) => constrainPipTiming(clip, edge, delta, overlayScenes(project), projectTicks, project.timebase, minTicks(project.timebase));
    const move = (moveEvent: PointerEvent) => {
      const delta = Math.round((moveEvent.clientX - startX) / track.width * projectTicks);
      moved ||= Math.abs(moveEvent.clientX - startX) > 2;
      const raw = constrain(delta);
      const snapped = snapEdges(edge, raw.startTicks, raw.durationTicks, points, threshold);
      const timing = snapped.guide ? constrain(edge === 'end' ? snapped.startTicks + snapped.durationTicks - clip.startTicks - clip.durationTicks : snapped.startTicks - clip.startTicks) : raw;
      setSnapGuide(landedOn(snapped.guide, timing.startTicks, timing.durationTicks));
      const next = { ...clip, ...timing };
      pipDraftRef.current = next;
      setPipDraft(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setSnapGuide(null);
      const draft = pipDraftRef.current;
      pipDraftRef.current = null;
      setPipDraft(null);
      if (moved && draft) void run({ type: 'pip', scenes: overlayScenes(project).map(item => item.id === draft.id ? draft : item) });
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setSnapGuide(null);
      pipDraftRef.current = null;
      setPipDraft(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  async function addMediaPip(source: Scene) {
    if (!selectedScene) { setNotice(t('Select the background scene first, then add picture in picture.')); return; }
    const existing = overlayScenes(project);
    if (existing.length >= 50) { setNotice(t('This project already has 50 picture-in-picture clips.')); return; }
    try {
      let sourceAspect = 16 / 9;
      if (source.mediaKind === 'video') {
        const probe = await probeVideo((await resolveMediaSource(source.image)) ?? source.image);
        sourceAspect = probe.width / probe.height;
      } else {
        const image = await loadImage(source.image);
        sourceAspect = image.naturalWidth / image.naturalHeight;
      }
      const minimum = minTicks(project.timebase);
      const desired = Math.max(0, Math.min(projectTicks - 1, secondsToTicks(position, project.timebase)));
      if (projectTicks - desired < minimum) { setNotice(t('Move the playhead earlier to fit a picture-in-picture clip.')); return; }
      let durationTicks = Math.min(source.durationTicks, projectTicks - desired);
      if (source.mediaKind === 'video' && source.sourceDurationSeconds) {
        durationTicks = Math.min(durationTicks, pipSourceRoom(source, project.timebase));
      }
      durationTicks = Math.max(minimum, Math.min(durationTicks, projectTicks));
      const startTicks = freePipStart(existing, desired, durationTicks, projectTicks);
      if (startTicks === null) {
        setNotice(t('There is no free space for picture in picture there. Move the playhead or shorten an existing clip.'));
        return;
      }
      const width = .32;
      const height = Math.max(.08, Math.min(.9, width * (activeSize.width / activeSize.height) / Math.max(.1, sourceAspect)));
      const clip: Scene = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        startTicks,
        durationTicks,
        transition: null,
        textLayers: [],
        elements: [],
        pip: { x: .8, y: .78, width, height, radius: .06, shadow: 60 },
      };
      if (await run({ type: 'pip', scenes: [...existing, clip].sort((a, b) => a.startTicks - b.startTicks) })) {
        setSelectedPipId(clip.id);
        setSelectedIds([]); setPrimarySelected(null);
        setEditTarget('scene'); setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedElementId(null);
        setPosition(ticksToSeconds(startTicks, project.timebase));
        setNotice(t('Picture in picture added. Adjust its corner and size in the inspector.'));
      }
    } catch (error) {
      setError(messageFor(error));
    }
  }

  return { removePip, addMediaPip, stagePip, commitPip, stagePipStyle, selectPip, beginPipTiming };
}
