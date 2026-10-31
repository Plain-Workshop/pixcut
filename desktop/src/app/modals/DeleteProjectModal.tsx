import { sceneCount, t } from '../../i18n';
import { Clapperboard, Trash2 } from 'lucide-react';
import { timecode } from '../../stores/model';
import { type ProjectSummary } from '../../stores/library';

export function DeleteProjectModal({ deleteTarget, confirmDeleteProject, requestCloseModal }: {
  deleteTarget: ProjectSummary | null;
  confirmDeleteProject: () => Promise<void>;
  requestCloseModal: () => void;
}) {
  return (
    <>
      <h2 id="modal-title">Delete “{deleteTarget?.name}”?</h2>
      <p>The project moves to Recently deleted on the Projects page, where you can restore it for 30 days. After that it and its embedded photos are removed from this device. Exported videos and downloaded project backups are not affected.</p>
      {deleteTarget && <div className="delete-summary">
        {deleteTarget.thumbnail ? <img src={deleteTarget.thumbnail} alt="" /> : <span className="delete-summary-icon"><Clapperboard size={20} /></span>}
        <div><strong>{deleteTarget.name}</strong><small>{sceneCount(deleteTarget.sceneCount)} · {timecode(deleteTarget.duration, deleteTarget.timebase)} · {deleteTarget.aspect}</small></div>
      </div>}
      <div className="modal-actions">
        <button className="button danger" onClick={() => void confirmDeleteProject()}><Trash2 size={16} /> Move to Recently deleted</button>
        <button className="button" onClick={requestCloseModal}>{t('Keep project')}</button>
      </div>
    </>
  );
}
