import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { isAssetRef, resolveMediaSource } from './media-url';

/**
 * An `<img>` whose source may be a streamed asset reference. Data and blob URLs
 * render synchronously; references wait for the asset protocol, then render or
 * show the caller's fallback if the store lost the file.
 */
export function AssetImage({ source, fallback, ...props }: ImgHTMLAttributes<HTMLImageElement> & { source?: string; fallback?: ReactNode }) {
  const direct = source && !isAssetRef(source) ? source : undefined;
  const [resolved, setResolved] = useState<string | undefined>(direct);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!source) { setResolved(undefined); return; }
    if (!isAssetRef(source)) { setResolved(source); return; }
    setResolved(undefined);
    void resolveMediaSource(source).then(url => {
      if (cancelled) return;
      if (url) setResolved(url); else setFailed(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [source]);
  if (resolved) return <img src={resolved} {...props} />;
  return failed && fallback ? <>{fallback}</> : null;
}

/** The repeating timeline filmstrip for a scene, resolved for streamed photos. */
export function ClipFilmstrip({ source, className }: { source?: string; className?: string }) {
  const direct = source && !isAssetRef(source) ? source : undefined;
  const [url, setUrl] = useState<string | undefined>(direct);
  useEffect(() => {
    let cancelled = false;
    if (!source) { setUrl(undefined); return; }
    if (!isAssetRef(source)) { setUrl(source); return; }
    setUrl(undefined);
    void resolveMediaSource(source).then(resolved => { if (!cancelled && resolved) setUrl(resolved); }).catch(() => {});
    return () => { cancelled = true; };
  }, [source]);
  return <span className={className} style={url ? { backgroundImage: `url(${url})` } : undefined} aria-hidden="true" />;
}
