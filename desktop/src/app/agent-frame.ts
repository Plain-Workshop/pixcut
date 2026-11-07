import { formatSize } from '../stores/formats';
import { projectScenes, sceneAt, sceneSeconds, ticksToSeconds, totalDuration, type Project, type Scene } from '../stores/model';
import { drawProjectText, drawScene } from '../components/preview/render';
import { canvasPng } from '../components/preview/png';

export type FrameRequest = { requestId: string; sceneId?: string | null; atSeconds?: number | null; maxWidth?: number | null };
export type FrameTarget = { scene: Scene; localSeconds: number; projectSeconds: number };

/**
 * Picks the clip and moment an agent asked to see. With a scene id, `atSeconds`
 * is measured from the clip start; without one it is project time. Both are
 * clamped inside the clip so an out-of-range ask still returns a real frame.
 */
export function resolveFrameTarget(project: Project, request: Pick<FrameRequest, 'sceneId' | 'atSeconds'>): FrameTarget {
  const scenes = projectScenes(project);
  if (!scenes.length) throw new Error('Add a clip before asking for a preview frame.');
  const at = Number.isFinite(request.atSeconds) ? Math.max(0, request.atSeconds as number) : 0;
  let scene: Scene | undefined;
  let local = 0;
  if (request.sceneId) {
    scene = scenes.find(candidate => candidate.id === request.sceneId);
    if (!scene) throw new Error(`No scene has the id “${request.sceneId}”.`);
    local = at;
  } else {
    const hit = sceneAt(project, Math.min(at, Math.max(0, totalDuration(project) - 0.001)));
    scene = hit?.scene ?? scenes[scenes.length - 1];
    local = hit ? at - hit.start : 0;
  }
  const length = sceneSeconds(scene, project.timebase);
  local = Math.min(Math.max(0, local), Math.max(0, length - 0.001));
  return { scene, localSeconds: local, projectSeconds: ticksToSeconds(scene.startTicks, project.timebase) + local };
}

/** The output size: the first format's shape, scaled to fit the requested width. */
export function frameSize(project: Project, maxWidth?: number | null) {
  const full = formatSize(project.formats[0]);
  const wanted = Number.isFinite(maxWidth) ? Math.round(maxWidth as number) : 960;
  const width = Math.min(Math.max(wanted, 160), 1920, full.width);
  return { width, height: Math.max(1, Math.round(full.height * (width / full.width))) };
}

/** Renders one still with the same compositor as the viewer and the export. */
export async function renderAgentFrame(project: Project, request: FrameRequest): Promise<{ png: string; width: number; height: number }> {
  const target = resolveFrameTarget(project, request);
  const size = frameSize(project, request.maxWidth);
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  await drawScene(canvas, target.scene, project.aspect, 'export', target.localSeconds, project.timebase, size, null, project.audio, project.overlays ?? [], target.projectSeconds);
  await drawProjectText(canvas, project.globalText ?? [], target.projectSeconds, project.timebase);
  const url = await canvasPng(canvas);
  return { png: url.slice(url.indexOf(',') + 1), width: size.width, height: size.height };
}
