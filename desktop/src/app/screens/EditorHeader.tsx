import { t } from '../../i18n';
import { Keyboard, ChevronDown, Command as CommandIcon, Download, Redo2, Save, Undo2 } from 'lucide-react';
import { Brand } from '../../components/BrandLogo';
import { IconButton } from '../../components/IconButton';
import { type Command, type Project, type Scene, type Session } from '../../stores/model';
import type { Dispatch, SetStateAction } from 'react';

export function EditorHeader({ goHome, name, canEdit, setName, project, run, status, tip, runCommandId, session, ready, save, scenes, exporting, openExportModal }: {
  goHome: () => void;
  name: string;
  canEdit: boolean;
  setName: Dispatch<SetStateAction<string>>;
  project: Project;
  run: (command: Command) => Promise<boolean>;
  status: string;
  tip: (id: string, label: string) => string;
  runCommandId: (id: string) => void;
  session: Session;
  ready: boolean;
  save: () => Promise<void>;
  scenes: Scene[];
  exporting: boolean;
  openExportModal: () => void;
}) {
  return (
    <>
      <header className="editor-header">
        <button className="brand-button" aria-label={t('Back to home')} onClick={goHome}><Brand /></button>
        <span className="header-divider" />
        <span className="editor-mode">{t('Video Editor')}</span>
        <input className="project-name" aria-label={t('Project name')} value={name} maxLength={120} disabled={!canEdit} onChange={e => setName(e.target.value)} onBlur={() => { if (name !== project.name) void run({ type: 'rename', name: name.trim() || 'Untitled story' }); }} />
        <span className="save-status" role="status" aria-live="polite"><span className="status-dot" aria-hidden="true" />{status}</span>
        <div className="header-actions">
          <IconButton label={tip('palette.open', 'Command palette')} onClick={() => runCommandId('palette.open')}><CommandIcon size={17} /></IconButton>
          <IconButton label={tip('help.shortcuts', 'Keyboard shortcuts')} onClick={() => runCommandId('help.shortcuts')}><Keyboard size={17} /></IconButton>
          <span className="header-divider" />
          <IconButton label={tip('history.undo', 'Undo')} disabled={!session.canUndo || !canEdit} onClick={() => void run({ type: 'undo' })}><Undo2 size={17} /></IconButton>
          <IconButton label={tip('history.redo', 'Redo')} disabled={!session.canRedo || !canEdit} onClick={() => void run({ type: 'redo' })}><Redo2 size={17} /></IconButton>
          <button className="button subtle header-save" aria-label={t('Save project')} title={tip('project.save', 'Save project')} disabled={!ready} onClick={() => void save()}><Save size={15} /> <span>{t('Save')}</span></button>
          <button className="button export" title={tip('export.open', 'Export video')} disabled={!scenes.length || !ready || exporting} onClick={openExportModal}><Download size={15} /> {t('Export')} <ChevronDown size={12} /></button>
        </div>
      </header>
    </>
  );
}
