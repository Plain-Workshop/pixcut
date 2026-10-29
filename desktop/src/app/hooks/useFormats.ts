import { t } from '../../i18n';
import { type Dispatch, type SetStateAction } from 'react';
import { MAX_PROJECT_FORMATS, type Command, type FormatVariant, type Project, type Scene } from '../../stores/model';
import { createCustomFormat, createFormat, resolveSceneForFormat } from '../../stores/formats';

export type CustomFormatDraft = { name: string; width: number; height: number; fps: number; quality: 'draft' | 'standard' | 'high' };

export function useFormats({ project, run, setNotice, setError, activeFormat, setActiveFormatId, selectedScene, newFormatCount, setNewCustomFormats, customFormatDraft, setCustomFormatDraft }: {
  project: Project;
  run: (command: Command) => Promise<boolean>;
  setNotice: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  activeFormat: FormatVariant | undefined;
  setActiveFormatId: Dispatch<SetStateAction<string | null>>;
  selectedScene: Scene | null | undefined;
  newFormatCount: number;
  setNewCustomFormats: Dispatch<SetStateAction<FormatVariant[]>>;
  customFormatDraft: CustomFormatDraft;
  setCustomFormatDraft: Dispatch<SetStateAction<CustomFormatDraft>>;
}) {
  async function addFormat(presetId: string) {
    if (project.formats.length >= MAX_PROJECT_FORMATS) { setNotice(t('A project supports up to {max} output formats.', { max: MAX_PROJECT_FORMATS })); return; }
    const format = createFormat(presetId, project.formats);
    if (await run({ type: 'formats', formats: [...project.formats, format] })) {
      setActiveFormatId(format.id);
      setNotice(t('{name} added. Framing is saved separately for this format.', { name: format.name }));
    }
  }

  async function toggleFormatPreset(presetId: string) {
    const existing = project.formats.find(format => format.presetId === presetId);
    if (existing) await removeFormat(existing.id);
    else await addFormat(presetId);
  }

  function addNewCustomFormat() {
    if (newFormatCount >= MAX_PROJECT_FORMATS) { setNotice(t('A project supports up to {max} output formats.', { max: MAX_PROJECT_FORMATS })); return; }
    const width = Math.round(customFormatDraft.width / 2) * 2;
    const height = Math.round(customFormatDraft.height / 2) * 2;
    if (width < 160 || height < 160 || width > 3840 || height > 3840) { setError(t('Custom size must be between 160 and 3840 pixels.')); return; }
    setNewCustomFormats(current => [...current, createCustomFormat(customFormatDraft.name, width, height, customFormatDraft.fps, customFormatDraft.quality, current)]);
    setCustomFormatDraft({ name: '', width: 1080, height: 1080, fps: 30, quality: 'standard' });
  }

  async function addCustomFormat() {
    if (project.formats.length >= MAX_PROJECT_FORMATS) { setNotice(t('A project supports up to {max} output formats.', { max: MAX_PROJECT_FORMATS })); return; }
    const width = Math.round(customFormatDraft.width / 2) * 2;
    const height = Math.round(customFormatDraft.height / 2) * 2;
    if (width < 160 || height < 160 || width > 3840 || height > 3840) { setError(t('Custom size must be between 160 and 3840 pixels.')); return; }
    const format = createCustomFormat(customFormatDraft.name, width, height, customFormatDraft.fps, customFormatDraft.quality, project.formats);
    if (await run({ type: 'formats', formats: [...project.formats, format] })) {
      setActiveFormatId(format.id);
      setCustomFormatDraft({ name: '', width: 1080, height: 1080, fps: 30, quality: 'standard' });
      setNotice(t('{name} added.', { name: format.name }));
    }
  }

  async function updateFormatSettings(format: FormatVariant, patch: Partial<FormatVariant>) {
    const width = Math.round((patch.width ?? format.width) / 2) * 2;
    const height = Math.round((patch.height ?? format.height) / 2) * 2;
    if (width < 160 || height < 160 || width > 3840 || height > 3840) { setError(t('Format size must be between 160 and 3840 pixels.')); return; }
    const next = project.formats.map(item => item.id === format.id ? { ...item, ...patch, width, height, name: (patch.name ?? item.name).trim() || item.name } : item);
    await run({ type: 'formats', formats: next });
  }

  async function removeFormat(formatId: string) {
    if (project.formats.length <= 1) { setNotice(t('Keep at least one output format.')); return; }
    const formats = project.formats.filter(format => format.id !== formatId);
    if (await run({ type: 'formats', formats })) {
      if (activeFormat?.id === formatId) setActiveFormatId(formats[0]?.id ?? null);
      setNotice(t('Output format removed.'));
    }
  }

  async function applyFramingToAllFormats() {
    const scene = selectedScene;
    if (!scene || !activeFormat) return;
    const resolved = resolveSceneForFormat(scene, activeFormat);
    const override = { imageX: resolved.imageX ?? 0, imageY: resolved.imageY ?? 0, imageZoom: resolved.imageZoom ?? 1, fit: resolved.fit, framingBackground: resolved.framingBackground ?? '#000000' };
    const formats = project.formats.map(format => ({ ...format, overrides: { ...format.overrides, [scene.id]: { ...format.overrides[scene.id], ...override } } }));
    if (await run({ type: 'formats', formats })) setNotice(t('Current framing copied to every output format.'));
  }

  return { addFormat, toggleFormatPreset, addNewCustomFormat, addCustomFormat, updateFormatSettings, removeFormat, applyFramingToAllFormats };
}
