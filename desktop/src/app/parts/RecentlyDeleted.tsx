import { useState } from 'react';
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import type { ProjectSummary } from '../../stores/library';
import { trashDaysLeft } from '../../stores/trash';

export type DeletedControls = {
  items: ProjectSummary[];
  restore: (entry: ProjectSummary) => Promise<void>;
  purge: (entry: ProjectSummary) => Promise<void>;
};

/** Projects deleted in the last 30 days, with restore and a two-click "delete for good". */
export function RecentlyDeleted({ deleted }: { deleted: DeletedControls }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!deleted.items.length) return null;
  return <section className="recently-deleted" aria-label="Recently deleted">
    <button className="recently-deleted-head" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Trash2 size={14} /> <strong>{t('Recently deleted')}</strong> <span>{deleted.items.length}</span> <ChevronDown size={14} className={open ? 'open' : ''} />
    </button>
    {open && <ul>
      {deleted.items.map(entry => <li key={entry.id}>
        {entry.thumbnail ? <img src={entry.thumbnail} alt="" /> : <span className="deleted-thumb" />}
        <div><strong>{entry.name}</strong><small>{t('Removed for good in {days} days', { days: trashDaysLeft(entry.deletedAt ?? 0) })}</small></div>
        <button className="button subtle" onClick={() => void deleted.restore(entry)}><RotateCcw size={13} /> {t('Restore')}</button>
        <button className={`button ${confirming === entry.id ? 'danger' : 'subtle'}`} onClick={() => { if (confirming === entry.id) { setConfirming(null); void deleted.purge(entry); } else setConfirming(entry.id); }}><Trash2 size={13} /> {confirming === entry.id ? t('Confirm: delete for good') : t('Delete for good')}</button>
      </li>)}
    </ul>}
  </section>;
}
