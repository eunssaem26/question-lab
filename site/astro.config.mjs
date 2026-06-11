// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  site: 'https://question-lab.vercel.app',
  integrations: [mdx(), sitemap()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Noto Sans KR',
      cssVariable: '--font-korean',
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
});
