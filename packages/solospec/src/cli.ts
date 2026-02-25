#!/usr/bin/env node

import { Command } from 'commander';
import { renderDocument } from '#src/api';
import type { MetadataRowKey } from '#src/types';

const ALL_METADATA_KEYS: MetadataRowKey[] = [
  'status',
  'shortName',
  'version',
  'publishDate',
  'lastUpdateDate',
  'maturityLevel',
  'group',
  'repository',
  'editors',
  'authors',
  'deps',
  'license',
  'copyright',
];

function parseMetadataOrder(value: string): MetadataRowKey[] {
  const keys = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const invalid = keys.filter((key) => !ALL_METADATA_KEYS.includes(key as MetadataRowKey));
  if (invalid.length > 0) {
    throw new Error(`Invalid metadata keys: ${invalid.join(', ')}`);
  }

  return keys as MetadataRowKey[];
}

const program = new Command();

program
  .name('speculator-render')
  .description('Render a Speculator document as static HTML without Astro')
  .requiredOption('--entry <path>', 'Path to entry document (Markdown or HTML)')
  .option('--config <path>', 'Optional config.json path')
  .option('--out <path>', 'Output HTML path', 'dist/index.html')
  .option('--base-path <path>', 'Base path for cross-document links')
  .option('--meta-order <list>', 'Comma-separated metadata row order', parseMetadataOrder)
  .option('--likec4-workspace <path>', 'Workspace root for LikeC4 source discovery')
  .option('--likec4-project <id>', 'LikeC4 project ID')
  .action(async (options) => {
    const result = await renderDocument({
      entry: options.entry,
      configPath: options.config,
      output: options.out,
      options: {
        basePath: options.basePath,
        metadata: options.metaOrder ? { rowOrder: options.metaOrder } : undefined,
        client: {
          likec4Workspace: options.likec4Workspace,
          likec4Project: options.likec4Project,
        },
      },
    });

    process.stdout.write(`Rendered ${result.document.id} -> ${options.out}\\n`);
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
