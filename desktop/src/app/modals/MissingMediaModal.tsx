import * as bridge from '../bridge';
import { type MissingAsset } from '../../stores/missing-assets';
import { Check, Film, ImagePlus, Music } from 'lucide-react';

export function MissingMediaModal({ missing, relinking, relinkMissing, requestCloseModal }: {
  missing: MissingAsset[];
  relinking: string | null;
  relinkMissing: (asset: MissingAsset) => Promise<void>;
  requestCloseModal: () => void;
}) {
  return (
    <>
      <h2 id="modal-title">Relink missing media.</h2>
      <p>These files are no longer in PixCut’s local media store. Choose a replacement for each one; the project’s edits and timing stay unchanged. Saving and exporting resume once every item is linked.</p>
      {missing.length > 0 ? <div className="missing-list">{missing.map(asset => <div className="missing-row" key={asset.ref}>
        <span className="missing-row-icon">{asset.kind === 'audio' ? <Music size={16} /> : asset.kind === 'video' ? <Film size={16} /> : <ImagePlus size={16} />}</span>
        <span className="missing-row-copy"><strong>{asset.label}</strong><small>{asset.kind} · {asset.ref.slice(13, 21)}…</small></span>
        <button className="button" title={bridge.native ? 'Choose a replacement file' : 'Relinking is available in the desktop app'} disabled={!bridge.native || relinking !== null} onClick={() => void relinkMissing(asset)}>{relinking === asset.ref ? 'Choosing…' : 'Choose file'}</button>
      </div>)}</div> : <div className="missing-done"><Check size={17} /><span><strong>All media is linked again.</strong><small>You can save and export this project.</small></span></div>}
      <div className="modal-actions"><button className="button primary" onClick={requestCloseModal}>Done</button></div>
    </>
  );
}
