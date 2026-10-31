import React from 'react';
import { t } from '../i18n';

export function IconButton({ label, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) { return <button type="button" className={`icon-button ${className ?? ''}`} title={t(label)} aria-label={t(label)} {...props}>{children}</button>; }
// Brand is provided by ./BrandLogo using the canonical PixCut mark.
