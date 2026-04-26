import { defineConfig } from 'astro/config';

// PUBLIC_BASE 让 GH Actions build 时注入 base 路径（例如 /DeepDive/Dong/）。
// 本地 npm run dev / build 时不设，用根路径 '/'，体验一致。
const base = process.env.PUBLIC_BASE || '/';

export default defineConfig({
  site: process.env.PUBLIC_SITE || 'https://example.com',
  base,
  trailingSlash: 'always',
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
});
