import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Preview builds publish to a project page under dondonkey.github.io, so they
// need a base path — and must never ship a CNAME, which would try to bind the
// live domain to the preview repo.
const preview = process.env.PREVIEW === '1';

export default defineConfig({
  site: preview ? 'https://dondonkey.github.io' : 'https://www.smashglass.com',
  base: preview ? '/smashglass-preview' : '/',
  integrations: [preact({ compat: true }), sitemap()],
  vite: { plugins: [tailwindcss()] },
  build: { inlineStylesheets: 'auto' },
});
