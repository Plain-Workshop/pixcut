import { minTicks, secondsToTicks, type AudioClip, type Scene } from '../stores/model';
import { t } from '../i18n';
import type { CommandAvailability } from '../shortcuts/registry';

const AVAILABLE: CommandAvailability = { disabled: false };

/** Everything a command's availability depends on, read once per question. */
export type AvailabilityContext = {
  screen: 'home' | 'editor';
  ready: boolean;
  busy: boolean;
  /** Ready and not busy: the project may be edited. */
  canEdit: boolean;
  exporting: boolean;
  canUndo: boolean;
  canRedo: boolean;
  scenes: readonly Scene[];
  /** The clips selected on purpose, or the active one standing in for them. */
  selectedScenes: readonly Scene[];
  selectedScene: Scene | undefined;
  /** Playhead, in seconds. */
  position: number;
  timebase: Parameters<typeof minTicks>[0];
  duration: number;
  projectTicks: number;
  /** What the keyboard edits: a clip, text, an element or an audio clip. */
  editTarget: 'scene' | 'text' | 'element' | 'audio';
  /** The audio clip being edited, when the target is audio. */
  audioTargetId: string | null;
  audio: readonly AudioClip[];
  selectedAudio: AudioClip | null;
  lockedLanes: readonly string[];
  /** The lane the selection sits in; called only when a lane-locked edit is asked about. */
  selectionLane: () => string;
};

const LANE_EDITS = new Set(['clip.delete', 'clip.ripple_delete', 'clip.split', 'clip.trim_start', 'clip.trim_end', 'clip.nudge_left', 'clip.nudge_right', 'clip.nudge_left_10', 'clip.nudge_right_10']);

/** Whether a command can run now, and if not, why. Locked lanes refuse every keyboard edit, whatever the command. */
export function commandAvailability(id: string, ctx: AvailabilityContext): CommandAvailability {
  if (LANE_EDITS.has(id) && ctx.lockedLanes.includes(ctx.selectionLane())) return { disabled: true, reason: t('This lane is locked. Unlock it to edit.') };
  return baseAvailability(id, ctx);
}

function baseAvailability(id: string, ctx: AvailabilityContext): CommandAvailability {
  if (ctx.exporting && id === 'export.open') return { disabled: true, reason: t('An export is already running.') };
  const editor = ctx.screen === 'editor';
  const hasProject = ctx.scenes.length > 0;
  const scene = ctx.selectedScene;
  const sceneStartTicks = scene?.startTicks ?? 0;
  const sceneOffsetTicks = secondsToTicks(ctx.position, ctx.timebase) - sceneStartTicks;
  const splitMinimum = minTicks(ctx.timebase);
  switch (id) {
    case 'project.new': return ctx.ready ? AVAILABLE : { disabled: true, reason: t('PixCut is still loading.') };
    case 'project.open': return ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Finish the current operation first.') };
    case 'project.save': return ctx.ready ? AVAILABLE : { disabled: true, reason: t('PixCut is still loading.') };
    case 'project.import': return ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Finish the current operation first.') };
    case 'export.open': return hasProject && ctx.ready && !ctx.busy ? AVAILABLE : { disabled: true, reason: hasProject ? t('PixCut is busy.') : t('Add at least one scene to export.') };
    case 'history.undo': return ctx.canUndo && ctx.canEdit ? AVAILABLE : { disabled: true, reason: ctx.canUndo ? t('Finish the current operation first.') : t('Nothing to undo.') };
    case 'history.redo': return ctx.canRedo && ctx.canEdit ? AVAILABLE : { disabled: true, reason: ctx.canRedo ? t('Finish the current operation first.') : t('Nothing to redo.') };
    case 'playback.toggle':
    case 'playback.forward':
    case 'playback.reverse':
    case 'playback.stop':
      if (!editor) return { disabled: true, reason: t('Open a story to use playback.') };
      if (!ctx.duration) return { disabled: true, reason: t('Add a scene to play.') };
      return ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Finish the current operation first.') };
    case 'clip.split':
      if (!editor) return { disabled: true, reason: t('Open a story to edit clips.') };
      if (!ctx.canEdit) return { disabled: true, reason: t('Finish the current operation first.') };
      if (ctx.editTarget === 'audio') {
        const audioClip = ctx.audio.find(item => item.id === ctx.audioTargetId) ?? ctx.selectedAudio;
        if (!audioClip) return { disabled: true, reason: t('Select an audio clip first.') };
        const audioOffsetTicks = secondsToTicks(ctx.position, ctx.timebase) - audioClip.startTicks;
        return audioOffsetTicks >= splitMinimum && audioClip.durationTicks - audioOffsetTicks >= splitMinimum ? AVAILABLE : { disabled: true, reason: t('Place the playhead at least half a second inside the selected audio clip.') };
      }
      if (!ctx.selectedScenes.length) return { disabled: true, reason: t('Select a clip first.') };
      if (ctx.selectedScenes.length !== 1) return { disabled: true, reason: t('Select one clip to split.') };
      return scene && sceneOffsetTicks >= splitMinimum && scene.durationTicks - sceneOffsetTicks >= splitMinimum ? AVAILABLE : { disabled: true, reason: t('Place the playhead at least half a second inside the selected clip.') };
    case 'clip.delete':
    case 'clip.ripple_delete':
      if (!editor) return { disabled: true, reason: t('Open a story to edit clips.') };
      if (ctx.editTarget !== 'audio' && !ctx.selectedScenes.length || ctx.editTarget === 'audio' && !ctx.audioTargetId) return { disabled: true, reason: t('Select a clip first.') };
      return ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Finish the current operation first.') };
    case 'clip.duplicate':
      if (!editor) return { disabled: true, reason: t('Open a story to edit clips.') };
      if (!ctx.selectedScenes.length) return { disabled: true, reason: t('Select a clip first.') };
      return ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Finish the current operation first.') };
    case 'clip.trim_start':
    case 'clip.trim_end':
    case 'clip.nudge_left':
    case 'clip.nudge_right':
    case 'clip.nudge_left_10':
    case 'clip.nudge_right_10':
    case 'clip.copy':
      if (!editor) return { disabled: true, reason: t('Open a story to edit clips.') };
      return ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Finish the current operation first.') };
    case 'clip.paste':
      return editor && ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Open a story to paste clips.') };
    case 'edit.select_after':
      return ctx.scenes.length && ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Open a project with scenes first.') };
    case 'timeline.prev_frame':
    case 'timeline.next_frame':
    case 'timeline.prev_edit':
    case 'timeline.next_edit':
    case 'timeline.back_second':
    case 'timeline.forward_second':
    case 'timeline.go_start':
    case 'timeline.go_end':
    case 'timeline.zoom_in':
    case 'timeline.zoom_out':
    case 'timeline.zoom_fit':
      return editor && ctx.duration > 0 ? AVAILABLE : { disabled: true, reason: t('Add a scene to move around the timeline.') };
    case 'timeline.snapping':
    case 'view.safe_area':
      return editor ? AVAILABLE : { disabled: true, reason: t('Open a story to use editor controls.') };
    case 'edit.select_all':
      return ctx.scenes.length && ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Open a project with scenes first.') };
    case 'edit.deselect':
      return AVAILABLE;
    case 'beat.add':
      return ctx.projectTicks && ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Add a scene before placing a beat.') };
    case 'text.add':
      return ctx.selectedScene && ctx.canEdit ? AVAILABLE : { disabled: true, reason: t('Select a scene first.') };
    default: return AVAILABLE;
  }
}
