// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE_URL ?? 'https://pixcut.app';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  integrations: [sitemap()],
  site,
  base,
  build: { format: 'directory' },
});
