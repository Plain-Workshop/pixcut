import { t } from '../../i18n';
import { Check, Trash2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

export function GroupsModal({ projectGroupsList, groupDrafts, setGroupDrafts, saveGroupRename, removeGroup, requestCloseModal }: {
  projectGroupsList: string[];
  groupDrafts: Record<string, string>;
  setGroupDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  saveGroupRename: (from: string) => Promise<void>;
  removeGroup: (group: string) => Promise<void>;
  requestCloseModal: () => void;
}) {
  return (
    <>
      <h2 id="modal-title">{t('Manage project groups.')}</h2>
      <p>{t('Rename a group or remove it. Removing a group keeps every project and simply moves those projects back to Ungrouped.')}</p>
      {projectGroupsList.length ? <div className="group-manager-list">{projectGroupsList.map(group => <div className="group-manager-row" key={group}><input aria-label={`Name for ${group}`} maxLength={60} value={groupDrafts[group] ?? group} onChange={event => setGroupDrafts(current => ({ ...current, [group]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') void saveGroupRename(group); }} /><button className="button" disabled={(groupDrafts[group] ?? group).trim() === group || !(groupDrafts[group] ?? '').trim()} onClick={() => void saveGroupRename(group)}><Check size={14} /> Save</button><button className="button danger" onClick={() => void removeGroup(group)}><Trash2 size={14} /> Remove</button></div>)}</div> : <p className="note">No groups yet. Use a project’s ••• menu to move it into one.</p>}
      <div className="modal-actions"><button className="button primary" onClick={requestCloseModal}>{t('Done')}</button></div>
    </>
  );
}
