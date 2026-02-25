import { defineConfig } from 'vite';
import { solospecPlugin } from '@openuji/solospec/vite';

export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: 'spec/index.md',
      configPath: 'spec/config.json',
      options: {
        client: {
          likec4Workspace: 'spec/diagrams',
        },
      },
    }) as any,
  ],
});
