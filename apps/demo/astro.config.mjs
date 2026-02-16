// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { LikeC4VitePlugin } from 'likec4/vite-plugin';
import path from 'node:path';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [
      LikeC4VitePlugin({
        workspace: path.resolve('spec'),
      }),
    ],
  },
});
