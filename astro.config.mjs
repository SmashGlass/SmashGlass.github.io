import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.smashglass.com',
  integrations: [preact({ compat: true }), sitemap()],
  vite: { plugins: [tailwindcss()] },
  build: { inlineStylesheets: 'auto' },
});
