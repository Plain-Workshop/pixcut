import symbolUrl from '../../assets/pixcut-symbol.svg';
import wordmarkUrl from '../../assets/pixcut-wordmark.svg';

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return <img src={symbolUrl} width={size} height={size} className={className} alt="PixCut" />;
}

export function BrandWordmark({ height = 28, className }: { height?: number; className?: string }) {
  return <img src={wordmarkUrl} height={height} className={className} alt="PixCut" style={{ width: 'auto' }} />;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  if (compact) return <span className="brand"><BrandMark size={27} /><span className="brand-text">PixCut</span></span>;
  return <span className="brand"><BrandMark size={32} /><span className="brand-text">PixCut</span></span>;
}