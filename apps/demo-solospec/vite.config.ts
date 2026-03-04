import { defineConfig } from 'vite';
import { solospecPlugin } from '@openuji/solospec/vite';

export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: 'spec/index.md',
      configPath: 'spec/config.json',
      theme: {
        name: 'bikeshed'
      }
    }),
  ],
});



