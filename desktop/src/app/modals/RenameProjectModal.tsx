import { t } from '../../i18n';
import { Check } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

export function RenameProjectModal({ renameDraft, setRenameDraft, renameProject, requestCloseModal }: {
  renameDraft: string;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  renameProject: () => Promise<void>;
  requestCloseModal: () => void;
}) {
  return (
    <>
      <h2 id="modal-title">{t('Rename this project.')}</h2>
      <p>{t('Give this story a name you will recognize. It is stored only on this device.')}</p>
      <label className="field rename-field">{t('Project name')}<input autoFocus maxLength={120} value={renameDraft} onChange={event => setRenameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void renameProject(); } }} /></label>
      <div className="modal-actions">
        <button className="button primary" disabled={!renameDraft.trim()} onClick={() => void renameProject()}><Check size={16} /> {t('Save name')}</button>
        <button className="button subtle" onClick={requestCloseModal}>{t('Cancel')}</button>
      </div>
    </>
  );
}
