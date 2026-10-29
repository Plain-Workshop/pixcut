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
      <p>This removes the project and its embedded photos from this device. It cannot be undone. Exported videos and downloaded project backups are not affected.</p>
      {deleteTarget && <div className="delete-summary">
        {deleteTarget.thumbnail ? <img src={deleteTarget.thumbnail} alt="" /> : <span className="delete-summary-icon"><Clapperboard size={20} /></span>}
        <div><strong>{deleteTarget.name}</strong><small>{deleteTarget.sceneCount} scene{deleteTarget.sceneCount === 1 ? '' : 's'} · {timecode(deleteTarget.duration, deleteTarget.timebase)} · {deleteTarget.aspect}</small></div>
      </div>}
      <div className="modal-actions">
        <button className="button danger" onClick={() => void confirmDeleteProject()}><Trash2 size={16} /> Delete project</button>
        <button className="button" onClick={requestCloseModal}>Keep project</button>
      </div>
    </>
  );
}
