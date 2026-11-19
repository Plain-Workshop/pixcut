import { useEffect } from 'react';
import { savePreferences, type Preferences } from '../../stores/preferences';
import { formatBytes } from '../helpers';
import { type Locale } from '../../i18n';
import type { ModalId } from '../modal';
import type { SettingsTab } from '../modals/SettingsModal';
import type { Dispatch, SetStateAction } from 'react';

export function useAppearanceEffects({ language, modal, preferences, setStorageLabel, setSystemDark, settingsTab }: {
  language: Locale;
  modal: ModalId | null;
  preferences: Preferences;
  setStorageLabel: Dispatch<SetStateAction<string>>;
  setSystemDark: Dispatch<SetStateAction<boolean>>;
  settingsTab: SettingsTab;
}) {
  useEffect(() => { savePreferences(preferences); }, [preferences]);
  useEffect(() => {
    if (preferences.theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, [preferences.theme]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  useEffect(() => {
    if (modal !== 'settings' || settingsTab !== 'privacy') return;
    let cancelled = false;
    navigator.storage?.estimate?.().then(({ usage, quota }) => {
      if (cancelled) return;
      setStorageLabel(`${formatBytes(usage ?? 0)} used${quota ? ` of ${formatBytes(quota)} available` : ''}`);
    }).catch(() => { if (!cancelled) setStorageLabel('Storage usage is unavailable in this preview.'); });
    return () => { cancelled = true; };
  }, [modal, settingsTab]);
}
