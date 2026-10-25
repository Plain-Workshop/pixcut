import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildSha = process.env.VITE_BUILD_SHA || 'dev';
const buildDate = process.env.VITE_BUILD_DATE || new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Cargo writes generated HTML during native builds; it must not reload the editor.
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
