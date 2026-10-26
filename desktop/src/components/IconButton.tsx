import React from 'react';

export function IconButton({ label, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) { return <button type="button" className={`icon-button ${className ?? ''}`} title={label} aria-label={label} {...props}>{children}</button>; }
// Brand is provided by ./BrandLogo using the canonical PixCut mark.
