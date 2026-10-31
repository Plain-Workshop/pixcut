import { t } from '../../i18n';
import { AlertTriangle, Check, X } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { errorTitle } from '../errors';
import { exportEta } from '../export-progress';

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="toast" role="status"><Check size={17} /><span>{message}</span><IconButton label="Dismiss notification" onClick={onDismiss}><X size={15} /></IconButton></div>;
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="error-banner" role="alert">
    <span className="error-badge"><AlertTriangle size={16} /></span>
    <span className="error-copy"><strong>{errorTitle(message)}</strong><span>{message}</span></span>
    <IconButton label="Dismiss error" onClick={onDismiss}><X size={16} /></IconButton>
  </div>;
}

export function ExportJobCard({ name, phase, progress, elapsed, cancelling, onCancel }: {
  name: string; phase: string; progress: number; elapsed: number; cancelling: boolean; onCancel: () => void;
}) {
  return <aside className="export-job" aria-label={t('Background export')}>
    <div><strong>Exporting {name}</strong><button className="text-button" onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel'}</button></div>
    <span>{phase} · {Math.round(progress)}%</span>
    <progress max="100" value={progress} />
    <span>{exportEta(elapsed, progress)}</span>
    <small>{t('You can keep editing. This export uses the version captured when you started.')}</small>
  </aside>;
}
