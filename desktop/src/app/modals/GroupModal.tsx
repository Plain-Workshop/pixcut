import { t } from '../../i18n';
import { FolderOpen } from 'lucide-react';
import { type ProjectSummary } from '../../stores/library';
import type { Dispatch, SetStateAction } from 'react';

export function GroupModal({ groupTarget, groupDraft, setGroupDraft, confirmGroupProject, projectGroupsList, requestCloseModal }: {
  groupTarget: ProjectSummary | null;
  groupDraft: string;
  setGroupDraft: Dispatch<SetStateAction<string>>;
  confirmGroupProject: (group: string | null) => Promise<void>;
  projectGroupsList: string[];
  requestCloseModal: () => void;
}) {
  return (
    <>
      <h2 id="modal-title">{t('Organize “{name}”.', { name: groupTarget?.name ?? '' })}</h2>
      <p>{t('Groups are local labels that keep related stories together. They never change the project file or move media.')}</p>
      <label className="field rename-field">{t('Group name')}<input autoFocus maxLength={60} placeholder={t('e.g. Client work, Summer 2026')} value={groupDraft} onChange={event => setGroupDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && groupDraft.trim()) { event.preventDefault(); void confirmGroupProject(groupDraft); } }} /></label>
      {projectGroupsList.length > 0 && <div className="group-suggestions"><span>{t('Existing groups')}</span><div>{projectGroupsList.map(group => <button key={group} className={`group-chip ${groupDraft === group ? 'active' : ''}`} onClick={() => setGroupDraft(group)}><FolderOpen size={11} />{group}</button>)}</div></div>}
      <div className="modal-actions">
        <button className="button primary" disabled={!groupDraft.trim()} onClick={() => void confirmGroupProject(groupDraft)}><FolderOpen size={16} /> {t('Move to group')}</button>
        {groupTarget?.group && <button className="button" onClick={() => void confirmGroupProject(null)}>{t('Remove from group')}</button>}
        <button className="button subtle" onClick={requestCloseModal}>{t('Cancel')}</button>
      </div>
    </>
  );
}
