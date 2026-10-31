import { lazy } from 'react';

/**
 * The big dialogs load when first opened, so they stay out of the first chunk.
 * The files are local, so a dialog opens within a frame or two; the dialog
 * shell shows meanwhile.
 */
export const SettingsModal = lazy(() => import('./SettingsModal').then(module => ({ default: module.SettingsModal })));
export const ExportModal = lazy(() => import('./ExportModal').then(module => ({ default: module.ExportModal })));
export const FormatsModal = lazy(() => import('./FormatsModal').then(module => ({ default: module.FormatsModal })));
export const NewProjectModal = lazy(() => import('./NewProjectModal').then(module => ({ default: module.NewProjectModal })));
export const TemplatesModal = lazy(() => import('./TemplatesModal').then(module => ({ default: module.TemplatesModal })));
export const SourceModal = lazy(() => import('./SourceModal').then(module => ({ default: module.SourceModal })));
