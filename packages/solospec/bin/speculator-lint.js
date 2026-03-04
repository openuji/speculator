#!/usr/bin/env node

import { resolveConfig } from 'vite';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

async function main() {
  try {
    // 1. Resolve vite config
    const config = await resolveConfig({}, 'serve');
    const solospecPlugin = config.plugins.find(p => p.name === 'vite-plugin-solospec');

    if (!solospecPlugin || !solospecPlugin.api || typeof solospecPlugin.api.getOptions !== 'function') {
      console.error('Could not find vite-plugin-solospec in your vite configuration.');
      return process.exit(1);
    }

    const pluginOptions = solospecPlugin.api.getOptions();
    if (!pluginOptions.entry) {
      console.error('solospecPlugin must provide an entry option.');
      return process.exit(1);
    }

    // 2. Generate temporary workspace configuration
    // Adding .workspace.json so speculator-lint CLI treats it as EntryMap rather than direct AST json
    const tmpWorkspacePath = resolve(process.cwd(), '.solospec-tmp.workspace.json');
    const workspaceConfig = {
      default: [
        {
          entry: pluginOptions.entry,
          ...(pluginOptions.configPath ? { configPath: pluginOptions.configPath } : {})
        }
      ]
    };

    writeFileSync(tmpWorkspacePath, JSON.stringify(workspaceConfig, null, 2), 'utf8');

    // Make sure we cleanup the temporary file
    process.on('exit', () => {
      try {
        unlinkSync(tmpWorkspacePath);
      } catch (e) {}
    });
    process.on('SIGINT', () => {
      process.exit(1);
    });

    // 3. Feed the path into the args
    // Insert the generated workspace.json path immediately after the script name
    // Process.argv is typically: [ '/path/to/node', '/path/to/speculator-lint.js', ...args ]
    process.argv.splice(2, 0, tmpWorkspacePath);

    // 4. Run the @openuji/speculator-lint CLI
    await import('@openuji/speculator-lint/bin/speculator-lint.js');

  } catch (error) {
    console.error('Failed to run speculator-lint via solospec:', error);
    process.exit(1);
  }
}

main();
