import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import * as bridge from '../bridge';
import { messageFor } from '../errors';
import { emptyProject, type Command, type Project } from '../../stores/model';
import { deleteLibraryProject, deleteProjectGroup, duplicateLibraryProject, getLibraryProject, listDeletedProjects, renameProjectGroup, restoreLibraryProject, saveLibraryProject, setProjectFavorite, setProjectGroup, trashLibraryProject, type ProjectSummary } from '../../stores/library';

export function useProjectLibrary({ projects, setProjects, project, latestProject, canEdit, launchProject, refreshLibrary, persistCurrent, run, setScreen, setModal, setNotice, setError, setSelectedIds, setPrimarySelected, selectionAnchor, setPosition }: {
  projects: ProjectSummary[];
  setProjects: Dispatch<SetStateAction<ProjectSummary[]>>;
  project: Project;
  latestProject: RefObject<Project>;
  canEdit: boolean;
  launchProject: (project: Project) => Promise<boolean>;
  refreshLibrary: () => Promise<void>;
  persistCurrent: () => Promise<unknown>;
  run: (command: Command) => Promise<boolean>;
  setScreen: Dispatch<SetStateAction<'home' | 'editor'>>;
  setModal: Dispatch<SetStateAction<any>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  selectionAnchor: RefObject<string | null>;
  setPosition: Dispatch<SetStateAction<number>>;
}) {
  const [projectMenu, setProjectMenu] = useState<string | null>(null), [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null), [renameDraft, setRenameDraft] = useState('');
  const [groupTarget, setGroupTarget] = useState<ProjectSummary | null>(null), [groupDraft, setGroupDraft] = useState('');
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [deletedProjects, setDeletedProjects] = useState<ProjectSummary[]>([]);
  const [batchMode, setBatchMode] = useState(false), [batchIds, setBatchIds] = useState<string[]>([]);

  useEffect(() => {
    if (!projectMenu) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(`[data-project-menu="${projectMenu}"], [data-project-actions="${projectMenu}"]`)) return;
      setProjectMenu(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [projectMenu]);

  async function openLibraryProject(summary: ProjectSummary) {
    setProjectMenu(null);
    if (summary.id === project.id) { setScreen('editor'); return; }
    if (!canEdit) return;
    try {
      const p = await getLibraryProject(summary.id);
      if (!p) throw new Error('This project could not be found on this device.');
      if (await launchProject(p)) setNotice(`Opened “${p.name}”.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function duplicateProject(summary: ProjectSummary) {
    setProjectMenu(null);
    if (!canEdit) return;
    try {
      const copy = await duplicateLibraryProject(summary.id);
      if (!copy) throw new Error('This project could not be duplicated.');
      await refreshLibrary();
      setNotice(`“${copy.name}” added to your library.`);
    } catch (e) { setError(messageFor(e)); }
  }

  function askDeleteProject(summary: ProjectSummary) {
    setProjectMenu(null);
    setDeleteTarget(summary);
    setModal('delete');
  }

  function askRenameProject(summary: ProjectSummary) {
    setProjectMenu(null);
    setRenameTarget(summary);
    setRenameDraft(summary.name);
    setModal('rename');
  }

  function askGroupProject(summary: ProjectSummary) {
    setProjectMenu(null);
    setGroupTarget(summary);
    setGroupDraft(summary.group ?? '');
    setModal('group');
  }

  async function confirmGroupProject(group: string | null) {
    const target = groupTarget;
    if (!target) return;
    setModal(null);
    setGroupTarget(null);
    try {
      await setProjectGroup(target.id, group);
      setProjects(items => items.map(item => item.id === target.id ? { ...item, ...(group?.trim() ? { group: group.trim() } : { group: undefined }) } : item));
      setNotice(group?.trim() ? `“${target.name}” moved to “${group.trim()}”.` : `“${target.name}” removed from its group.`);
    } catch (e) { setError(messageFor(e)); }
  }

  function projectGroups() {
    return [...new Set(projects.map(entry => entry.group).filter((group): group is string => Boolean(group)))].sort((a, b) => a.localeCompare(b));
  }

  function openGroupManager() {
    const groups = projectGroups();
    setGroupDrafts(Object.fromEntries(groups.map(group => [group, group])));
    setModal('groups');
  }

  async function saveGroupRename(from: string) {
    const to = groupDrafts[from]?.trim();
    if (!to || to === from) return;
    try {
      await renameProjectGroup(from, to);
      await refreshLibrary();
      setGroupDrafts(current => {
        const next = { ...current };
        delete next[from];
        next[to] = to;
        return next;
      });
      if (groupFilter === from) setGroupFilter(to);
      setNotice(`Group renamed to “${to}”.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function removeGroup(group: string) {
    try {
      await deleteProjectGroup(group);
      await refreshLibrary();
      setGroupDrafts(current => { const next = { ...current }; delete next[group]; return next; });
      if (groupFilter === group) setGroupFilter('all');
      setNotice(`“${group}” removed. Its projects are now ungrouped.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function toggleProjectFavorite(summary: ProjectSummary) {
    try {
      await setProjectFavorite(summary.id, !summary.favorite);
      setProjects(items => items.map(item => item.id === summary.id ? { ...item, ...(summary.favorite ? { favorite: undefined } : { favorite: true }) } : item));
      setNotice(summary.favorite ? `“${summary.name}” removed from favorites.` : `“${summary.name}” added to favorites.`);
      setProjectMenu(null);
    } catch (e) { setError(messageFor(e)); }
  }

  async function confirmDeleteProject() {
    const target = deleteTarget;
    if (!target) return;
    setModal(null);
    setDeleteTarget(null);
    try {
      await trashLibraryProject(target.id);
      setProjects(list => list.filter(item => item.id !== target.id));
      void refreshDeleted();
      if (target.id === latestProject.current.id) {
        await run({ type: 'replace', project: emptyProject() });
        setSelectedIds([]);
        setPrimarySelected(null);
        selectionAnchor.current = null;
        setPosition(0);
        setScreen('home');
      }
      setNotice(`“${target.name}” moved to Recently deleted. It is removed for good after 30 days.`);
    } catch (e) { setError(messageFor(e)); }
  }


  async function refreshDeleted() {
    try { setDeletedProjects(await listDeletedProjects()); } catch { setDeletedProjects([]); }
  }

  async function restoreProject(entry: ProjectSummary) {
    try {
      await restoreLibraryProject(entry.id);
      await refreshLibrary();
      await refreshDeleted();
      setNotice(`“${entry.name}” restored.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function purgeProject(entry: ProjectSummary) {
    try {
      await deleteLibraryProject(entry.id);
      await refreshDeleted();
      setNotice(`“${entry.name}” deleted from this device for good.`);
    } catch (e) { setError(messageFor(e)); }
  }

  function toggleBatch(id: string) { setBatchIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function endBatch() { setBatchMode(false); setBatchIds([]); }
  const batchTargets = () => projects.filter(entry => batchIds.includes(entry.id));

  async function batchFavorite(on: boolean) {
    const targets = batchTargets();
    try {
      for (const entry of targets) await setProjectFavorite(entry.id, on);
      setProjects(items => items.map(item => batchIds.includes(item.id) ? { ...item, favorite: on ? true : undefined } : item));
      setNotice(`${targets.length} project${targets.length === 1 ? '' : 's'} ${on ? 'added to' : 'removed from'} favorites.`);
      endBatch();
    } catch (e) { setError(messageFor(e)); }
  }

  async function batchMove(group: string | null) {
    const name = group?.trim() || null;
    const targets = batchTargets();
    try {
      for (const entry of targets) await setProjectGroup(entry.id, name);
      setProjects(items => items.map(item => batchIds.includes(item.id) ? { ...item, group: name ?? undefined } : item));
      setNotice(name ? `${targets.length} project${targets.length === 1 ? '' : 's'} moved to “${name}”.` : `${targets.length} project${targets.length === 1 ? '' : 's'} removed from their group.`);
      endBatch();
    } catch (e) { setError(messageFor(e)); }
  }

  async function batchDelete() {
    const targets = batchTargets();
    try {
      for (const entry of targets) await trashLibraryProject(entry.id);
      setProjects(items => items.filter(item => !batchIds.includes(item.id)));
      if (targets.some(entry => entry.id === latestProject.current.id)) {
        await run({ type: 'replace', project: emptyProject() });
        setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); setScreen('home');
      }
      setNotice(`${targets.length} project${targets.length === 1 ? '' : 's'} moved to Recently deleted.`);
      void refreshDeleted();
      endBatch();
    } catch (e) { setError(messageFor(e)); await refreshLibrary(); }
  }

  async function renameProject() {
    const target = renameTarget;
    if (!target) return;
    const name = renameDraft.trim().replace(/\s+/g, ' ').slice(0, 120) || 'Untitled story';
    try {
      if (target.id === latestProject.current.id) {
        if (!(await run({ type: 'rename', name }))) return;
        await persistCurrent();
      } else {
        const stored = await getLibraryProject(target.id);
        if (!stored) throw new Error('This project could not be found on this device.');
        await saveLibraryProject({ ...stored, name });
      }
      await refreshLibrary();
      setModal(null);
      setRenameTarget(null);
      setNotice(`Project renamed to “${name}”.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function exportLibraryProject(summary: ProjectSummary) {
    setProjectMenu(null);
    try {
      const stored = await getLibraryProject(summary.id);
      if (!stored) throw new Error('This project could not be found on this device.');
      if (await bridge.exportProjectFile(stored)) setNotice(`Project file for “${stored.name}” saved.`);
    } catch (e) { setError(messageFor(e)); }
  }

  return { deletedProjects, refreshDeleted, restoreProject, purgeProject, batchMode, setBatchMode, batchIds, toggleBatch, endBatch, batchFavorite, batchMove, batchDelete, projectMenu, setProjectMenu, deleteTarget, setDeleteTarget, setRenameTarget, renameDraft, setRenameDraft, groupTarget, setGroupTarget, groupDraft, setGroupDraft, groupDrafts, setGroupDrafts, groupFilter, setGroupFilter, openLibraryProject, duplicateProject, askDeleteProject, askRenameProject, askGroupProject, confirmGroupProject, projectGroups, openGroupManager, saveGroupRename, removeGroup, toggleProjectFavorite, confirmDeleteProject, renameProject, exportLibraryProject };
}
