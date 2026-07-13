// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://readtheplaces.com',

  // Static by default. The reader is the only island; every other page ships
  // zero JavaScript, which is what makes the walk pages indexable and fast.
  output: 'static',

  integrations: [svelte(), sitemap()],
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
