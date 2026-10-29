import { createContext, createElement, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { AudioClip, Command, Project, Scene } from '../stores/model';
import type { Preferences } from '../stores/preferences';

/**
 * The project-level data every editor panel reads: the project and its parts,
 * whether it can be edited right now, how to change it, and how to tell the
 * user what happened. `App` builds it once; panels read it instead of each
 * taking the same dozen props.
 */
export type EditorModel = {
  project: Project;
  scenes: Scene[];
  audio: AudioClip[];
  canEdit: boolean;
  /** Sends a command to the project; resolves to whether it was applied. */
  run: (command: Command) => Promise<boolean>;
  duration: number;
  projectTicks: number;
  frameSeconds: number;
  preferences: Preferences;
  activeSize: { width: number; height: number };
  setNotice: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
};

const EditorModelContext = createContext<EditorModel | null>(null);

export function EditorModelProvider({ value, children }: { value: EditorModel; children?: ReactNode }) {
  return createElement(EditorModelContext.Provider, { value }, children);
}

export function useEditorModel(): EditorModel {
  const model = useContext(EditorModelContext);
  if (!model) throw new Error('useEditorModel needs an EditorModelProvider.');
  return model;
}
