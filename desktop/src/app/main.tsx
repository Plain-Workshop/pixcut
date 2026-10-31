import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/inter/wght-italic.css';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/dm-sans/wght-italic.css';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/caveat';
import '@fontsource/bebas-neue';
import '@fontsource/archivo-black';
import '@fontsource/libre-baskerville/400.css';
import '@fontsource/libre-baskerville/700.css';
import '@fontsource/libre-baskerville/400-italic.css';
import '@fontsource/libre-baskerville/700-italic.css';
import App from './App';
import { isLocale, loadLocale, setLocale } from '../i18n';

/** The saved language is loaded before the first paint, so the interface never flashes English first. */
async function start() {
  try {
    const stored = localStorage.getItem('pixcut-language');
    if (isLocale(stored) && await loadLocale(stored)) setLocale(stored);
  } catch { /* storage is optional; English is the fallback */ }
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
}
void start();
