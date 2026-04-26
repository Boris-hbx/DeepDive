import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  base: '/',
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
});
