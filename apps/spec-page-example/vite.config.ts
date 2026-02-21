import { defineConfig } from 'vite';
import { specPagePlugin } from '@openuji/spec-page/vite';

export default defineConfig({
  plugins: [
    specPagePlugin({
      entry: 'spec/index.md',
      configPath: 'spec/config.json',
      options: {
        client: {
          likec4Workspace: 'spec/diagrams',
        },
      },
    }),
  ],
});
