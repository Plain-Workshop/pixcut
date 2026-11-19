import { MAX_PROJECT_FONTS, projectScenes, type Command, type Project } from '../../stores/model';
import { sceneTextLayers } from '../../components/text/layers';
import { subsetFontBytes } from '../../components/text/subset';
import { subsetCharacters } from '../../components/text/subset-chars';
import { captionCount, t } from '../../i18n';
import { formatBytes } from '../helpers';
import { messageFor } from '../errors';
import { textLayersAsCaptions, toSrt } from '../../components/text/captions-export';
import * as bridge from '../bridge';
import type { Dispatch, RefObject, SetStateAction } from 'react';

export function useFontsAndCaptions({ canEdit, fontInput, fontTargetId, latestProject, project, run, setError, setNotice }: {
  canEdit: boolean;
  fontInput: RefObject<HTMLInputElement | null>;
  fontTargetId: RefObject<string | null>;
  latestProject: RefObject<Project>;
  project: Project;
  run: (command: Command) => Promise<boolean>;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
}) {
  async function importFontFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canEdit) return;
    const targetId = fontTargetId.current;
    fontTargetId.current = null;
    const target = targetId ? (project.fonts ?? []).find(font => font.id === targetId) : undefined;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['ttf', 'otf', 'woff', 'woff2'].includes(extension)) throw new Error('Choose a TTF, OTF, WOFF, or WOFF2 font.');
      if (file.size > 40 * 1024 * 1024) throw new Error('Choose a font smaller than 40 MB.');
      if (!target && (project.fonts?.length ?? 0) >= MAX_PROJECT_FONTS) throw new Error(`A project supports up to ${MAX_PROJECT_FONTS} imported fonts.`);
      if ((extension === 'woff' || extension === 'woff2') && file.size > 2 * 1024 * 1024) {
        throw new Error('WOFF and WOFF2 fonts cannot be subset here. Choose a TTF or OTF under 2 MB, or a large TTF/OTF that PixCut can subset.');
      }
      const mime = extension === 'woff2' ? 'font/woff2' : extension === 'woff' ? 'font/woff' : extension === 'otf' ? 'font/otf' : 'font/ttf';
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('That font could not be read.'));
        reader.readAsDataURL(file);
      });
      if (!base64) throw new Error('That font file is empty.');
      let data = `data:${mime};base64,${base64}`;
      let subsetted = 0;
      // A CJK face is often tens of megabytes. Subset it to the project's text
      // plus everyday alphabets so it fits the same local project budget.
      if ((extension === 'ttf' || extension === 'otf') && file.size > 300_000) {
        try {
          const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
          const projectText = [
            ...projectScenes(project).flatMap(scene => sceneTextLayers(scene).flatMap(layer => [layer.title, layer.subtitle])),
            ...(project.globalText ?? []).flatMap(layer => [layer.title, layer.subtitle]),
            'The little moments',
          ].join(' ');
          const subset = await subsetFontBytes(bytes, subsetCharacters(projectText));
          if (subset.length && subset.length < bytes.length) {
            let binary = '';
            for (let index = 0; index < subset.length; index += 0x8000) {
              binary += String.fromCharCode(...subset.subarray(index, index + 0x8000));
            }
            data = `data:${mime};base64,${btoa(binary)}`;
            subsetted = subset.length;
          }
        } catch { /* fall back to the original if it fits the project budget */ }
      }
      if (data.length > 3_000_000) {
        throw new Error('This font is still larger than 2 MB after subsetting. Choose a TTF or OTF with fewer glyphs.');
      }
      const font = {
        id: target?.id ?? `custom-${crypto.randomUUID()}`,
        name: target?.name ?? (file.name.replace(/\.[^.]+$/, '').trim() || 'Imported font').slice(0, 60),
        data,
      };
      const fonts = target
        ? (project.fonts ?? []).map(item => item.id === target.id ? font : item)
        : [...(project.fonts ?? []), font];
      if (await run({ type: 'fonts', fonts })) {
        setNotice(subsetted
          ? (target ? t('“{name}” subset refreshed · {subset} of {original}.', { name: font.name, subset: formatBytes(subsetted), original: formatBytes(file.size) }) : t('“{name}” is now in the font picker · {subset} of {original}.', { name: font.name, subset: formatBytes(subsetted), original: formatBytes(file.size) }))
          : (target ? t('“{name}” updated.', { name: font.name }) : t('“{name}” is now in the font picker.', { name: font.name })));
      }
    } catch (error) {
      setError(messageFor(error));
    } finally {
      if (fontInput.current) fontInput.current.value = '';
    }
  }

  function removeFont(id: string) {
    const font = (project.fonts ?? []).find(item => item.id === id);
    void run({ type: 'fonts', fonts: (project.fonts ?? []).filter(item => item.id !== id) }).then(ok => {
      if (ok) setNotice(t('“{name}” removed. Text using it falls back to Inter.', { name: font?.name ?? t('Font') }));
    });
  }

  async function exportCaptions() {
    const captions = textLayersAsCaptions(projectScenes(latestProject.current), project.timebase);
    if (!captions.length) { setError(t('Add a title or caption layer before exporting captions.')); return; }
    try {
      const saved = await bridge.saveTextFile(toSrt(captions), `${project.name} - captions`, 'srt', 'SubRip subtitles');
      if (saved) setNotice(t('{captions} exported as an SRT file.', { captions: captionCount(captions.length) }));
    } catch (error) {
      setError(messageFor(error));
    }
  }

  return { importFontFile, removeFont, exportCaptions };
}
