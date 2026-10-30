import { describe, expect, it } from 'vitest';
import { commandAvailability, type AvailabilityContext } from '../src/app/command-availability';
import { emptyProject, secondsToTicks, type AudioClip, type Scene } from '../src/stores/model';

const timebase = emptyProject().timebase;
const ticks = (seconds: number) => secondsToTicks(seconds, timebase);
const scene = (id: string, startSeconds: number, seconds: number) => ({ id, startTicks: ticks(startSeconds), durationTicks: ticks(seconds) }) as Scene;
const clip = scene('a', 0, 4);

function context(patch: Partial<AvailabilityContext> = {}): AvailabilityContext {
  return {
    screen: 'editor', ready: true, busy: false, canEdit: true, exporting: false, canUndo: true, canRedo: true,
    scenes: [clip], selectedScenes: [clip], selectedScene: clip, position: 2, timebase, duration: 4, projectTicks: ticks(4),
    editTarget: 'scene', audioTargetId: null, audio: [], selectedAudio: null, lockedLanes: [], selectionLane: () => 'visuals', ...patch,
  };
}
const ok = (id: string, patch?: Partial<AvailabilityContext>) => commandAvailability(id, context(patch));

describe('command availability', () => {
  it('allows editing commands on a ready editor with a selected clip', () => {
    for (const id of ['clip.delete', 'clip.duplicate', 'clip.split', 'clip.copy', 'clip.paste', 'text.add', 'beat.add', 'playback.toggle', 'history.undo']) expect(ok(id).disabled, id).toBe(false);
  });

  it('allows unknown commands', () => {
    expect(ok('something.new', { screen: 'home', ready: false }).disabled).toBe(false);
  });

  it('blocks editing while an operation runs and says why', () => {
    const state = ok('clip.delete', { canEdit: false, busy: true });
    expect(state).toMatchObject({ disabled: true, reason: 'Finish the current operation first.' });
    expect(ok('project.open', { canEdit: false }).disabled).toBe(true);
  });

  it('asks the project to load before new, save and export', () => {
    expect(ok('project.new', { ready: false })).toMatchObject({ disabled: true, reason: 'PixCut is still loading.' });
    expect(ok('project.save', { ready: false }).disabled).toBe(true);
    expect(ok('export.open', { ready: false }).disabled).toBe(true);
  });

  it('explains export: no scenes, busy, already exporting', () => {
    expect(ok('export.open', { scenes: [] })).toMatchObject({ disabled: true, reason: 'Add at least one scene to export.' });
    expect(ok('export.open', { busy: true })).toMatchObject({ disabled: true, reason: 'PixCut is busy.' });
    expect(ok('export.open', { exporting: true })).toMatchObject({ disabled: true, reason: 'An export is already running.' });
    expect(ok('export.open').disabled).toBe(false);
  });

  it('distinguishes nothing to undo from an operation in progress', () => {
    expect(ok('history.undo', { canUndo: false })).toMatchObject({ disabled: true, reason: 'Nothing to undo.' });
    expect(ok('history.undo', { canEdit: false })).toMatchObject({ disabled: true, reason: 'Finish the current operation first.' });
    expect(ok('history.redo', { canRedo: false })).toMatchObject({ reason: 'Nothing to redo.' });
  });

  it('needs an open story, and a scene to play', () => {
    expect(ok('playback.toggle', { screen: 'home' })).toMatchObject({ disabled: true, reason: 'Open a story to use playback.' });
    expect(ok('playback.toggle', { duration: 0 })).toMatchObject({ disabled: true, reason: 'Add a scene to play.' });
    expect(ok('clip.copy', { screen: 'home' })).toMatchObject({ reason: 'Open a story to edit clips.' });
    expect(ok('clip.paste', { screen: 'home' })).toMatchObject({ reason: 'Open a story to paste clips.' });
  });

  describe('split', () => {
    it('needs the playhead inside the clip, away from both ends', () => {
      expect(ok('clip.split', { position: 2 }).disabled).toBe(false);
      expect(ok('clip.split', { position: 0.1 })).toMatchObject({ disabled: true, reason: 'Place the playhead at least half a second inside the selected clip.' });
      expect(ok('clip.split', { position: 3.95 }).disabled).toBe(true);
      expect(ok('clip.split', { position: 9 }).disabled).toBe(true);
    });
    it('needs exactly one selected clip', () => {
      expect(ok('clip.split', { selectedScenes: [] })).toMatchObject({ reason: 'Select a clip first.' });
      expect(ok('clip.split', { selectedScenes: [clip, scene('b', 4, 2)] })).toMatchObject({ reason: 'Select one clip to split.' });
    });
    it('splits the audio clip when audio is the target', () => {
      const audioClip = { id: 'song', startTicks: ticks(1), durationTicks: ticks(6) } as AudioClip;
      const audioTarget = { editTarget: 'audio' as const, audioTargetId: 'song', audio: [audioClip], selectedAudio: audioClip };
      expect(ok('clip.split', { ...audioTarget, position: 3 }).disabled).toBe(false);
      expect(ok('clip.split', { ...audioTarget, position: 1.1 })).toMatchObject({ reason: 'Place the playhead at least half a second inside the selected audio clip.' });
      expect(ok('clip.split', { editTarget: 'audio', audioTargetId: 'gone', audio: [], selectedAudio: null })).toMatchObject({ reason: 'Select an audio clip first.' });
    });
  });

  it('needs a selection to delete, by the right target', () => {
    expect(ok('clip.delete', { selectedScenes: [] })).toMatchObject({ disabled: true, reason: 'Select a clip first.' });
    expect(ok('clip.ripple_delete', { editTarget: 'audio', audioTargetId: null })).toMatchObject({ reason: 'Select a clip first.' });
    expect(ok('clip.delete', { editTarget: 'audio', audioTargetId: 'song', selectedScenes: [] }).disabled).toBe(false);
  });

  it('needs scenes for select-all, a scene for text, and length for a beat or the timeline', () => {
    expect(ok('edit.select_all', { scenes: [] }).reason).toBe('Open a project with scenes first.');
    expect(ok('text.add', { selectedScene: undefined }).reason).toBe('Select a scene first.');
    expect(ok('beat.add', { projectTicks: 0 }).reason).toBe('Add a scene before placing a beat.');
    expect(ok('timeline.zoom_in', { duration: 0 }).reason).toBe('Add a scene to move around the timeline.');
    expect(ok('timeline.snapping', { screen: 'home' }).reason).toBe('Open a story to use editor controls.');
    expect(ok('edit.deselect', { screen: 'home', canEdit: false }).disabled).toBe(false);
  });

  describe('locked lanes', () => {
    const edits = ['clip.delete', 'clip.ripple_delete', 'clip.split', 'clip.trim_start', 'clip.trim_end', 'clip.nudge_left', 'clip.nudge_right', 'clip.nudge_left_10', 'clip.nudge_right_10'];
    it('refuse every keyboard edit on the selection lane', () => {
      for (const id of edits) expect(ok(id, { lockedLanes: ['visuals'] }), id).toMatchObject({ disabled: true, reason: 'This lane is locked. Unlock it to edit.' });
    });
    it('leave other lanes and other commands alone', () => {
      expect(ok('clip.delete', { lockedLanes: ['audio-1'] }).disabled).toBe(false);
      expect(ok('clip.duplicate', { lockedLanes: ['visuals'] }).disabled).toBe(false);
    });
    it('only look up the lane for edits that a lock can stop', () => {
      let calls = 0;
      ok('playback.toggle', { lockedLanes: ['visuals'], selectionLane: () => { calls += 1; return 'visuals'; } });
      expect(calls).toBe(0);
    });
  });
});
