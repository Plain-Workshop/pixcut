import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import * as bridge from '../bridge';
import { t } from '../../i18n';

/** A banner on Home for problems that would otherwise only show up when an export fails. */
export function HomeHealth({ openSettings }: { openSettings: () => void }) {
  const [problems, setProblems] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found: string[] = [];
      if (bridge.native) {
        try { if (!await bridge.exporterAvailable()) found.push('FFmpeg was not found, so videos cannot be exported yet.'); } catch { /* unknown: stay quiet */ }
      }
      try {
        const { usage, quota } = await navigator.storage.estimate();
        if (usage && quota && usage / quota > .9) found.push('Local storage is almost full. Delete unused projects or clean up storage.');
      } catch { /* the estimate is optional */ }
      if (!cancelled) setProblems(found);
    })();
    return () => { cancelled = true; };
  }, []);
  if (!problems.length) return null;
  return <div className="home-health" role="status">
    <AlertTriangle size={16} />
    <div>{problems.map(problem => <p key={problem}>{t(problem)}</p>)}</div>
    <button className="button subtle" onClick={openSettings}>{t('Open settings')}</button>
  </div>;
}
