import { defineConfig } from 'vite';
import { solospecPlugin } from '@openuji/solospec/vite';

export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: 'spec/index.md',
      configPath: 'spec/config.json',
      theme: {
        name: 'bikeshed',
        mode: 'system',
        themeSwitcher: true,
        w3cLogo: true,
      },
      options: {
        client: {
          likec4Workspace: 'spec/diagrams',
        },
      },
    }) as any,
  ],
});
