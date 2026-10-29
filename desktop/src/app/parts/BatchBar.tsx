import { useState } from 'react';
import { FolderOpen, Star, Trash2, X } from 'lucide-react';
import { t } from '../../i18n';

export type BatchControls = {
  mode: boolean;
  ids: string[];
  begin: () => void;
  end: () => void;
  favorite: (on: boolean) => Promise<void>;
  move: (group: string | null) => Promise<void>;
  remove: () => Promise<void>;
};

/** Actions for the projects picked in select mode. Deleting asks for a second click inside the bar. */
export function BatchBar({ batch, groups, selectedCount }: { batch: BatchControls; groups: string[]; selectedCount: number }) {
  const [moving, setMoving] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState(false);
  const none = selectedCount === 0;
  const label = `${selectedCount} ${t('selected')}`;
  return <div className="batch-bar" role="toolbar" aria-label="Actions for selected projects">
    <strong>{label}</strong>
    <button className="button subtle" disabled={none} onClick={() => void batch.favorite(true)}><Star size={13} /> {t('Favorite')}</button>
    <button className="button subtle" disabled={none} onClick={() => void batch.favorite(false)}>{t('Unfavorite')}</button>
    <button className="button subtle" disabled={none} aria-expanded={moving} onClick={() => { setMoving(value => !value); setConfirming(false); }}><FolderOpen size={13} /> {t('Move to group…')}</button>
    <button className={`button ${confirming ? 'danger' : 'subtle'}`} disabled={none} onClick={() => { if (confirming) { setConfirming(false); void batch.remove(); } else { setConfirming(true); setMoving(false); } }}><Trash2 size={13} /> {confirming ? t('Confirm: move to Recently deleted') : t('Delete')}</button>
    <button className="button subtle batch-done" onClick={batch.end}><X size={13} /> {t('Done')}</button>
    {moving && !none && <div className="batch-move">
      <input autoFocus maxLength={60} aria-label="Group name" placeholder={t('Group name')} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && draft.trim()) void batch.move(draft); }} />
      {groups.map(group => <button key={group} className="group-chip" onClick={() => void batch.move(group)}>{group}</button>)}
      <button className="button primary" disabled={!draft.trim()} onClick={() => void batch.move(draft)}>{t('Move')}</button>
      <button className="button subtle" onClick={() => void batch.move(null)}>{t('Remove from group')}</button>
    </div>}
  </div>;
}
