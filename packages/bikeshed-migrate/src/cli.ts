#!/usr/bin/env node
/**
 * CLI for @openuji/bikeshed-migrate
 *
 * Usage:
 *   bikeshed-migrate <input.bs> [--out <dir>] [--id <id>] [--dry-run]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import { migrate } from './migrate.js';

function printUsage() {
    console.log(`
Usage: bikeshed-migrate <input.bs> [options]

Options:
  --out <dir>    Output directory (default: same directory as input file)
  --id <id>      Override document ID in config.json
  --dry-run      Print outputs to stdout without writing files
  --help         Show this help message
`.trim());
}

async function run() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    // Parse arguments
    let inputFile: string | undefined;
    let outDir: string | undefined;
    let idOverride: string | undefined;
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--out' || arg === '-o') {
            outDir = args[++i];
        } else if (arg === '--id') {
            idOverride = args[++i];
        } else if (arg === '--dry-run') {
            dryRun = true;
        } else if (!arg.startsWith('-')) {
            inputFile = arg;
        } else {
            console.error(`Unknown option: ${arg}`);
            printUsage();
            process.exit(1);
        }
    }

    if (!inputFile) {
        console.error('Error: No input file specified.');
        printUsage();
        process.exit(1);
    }

    const inputPath = resolve(inputFile);
    const outputDir = outDir ? resolve(outDir) : dirname(inputPath);
    const inputName = basename(inputFile, '.bs');

    // Read input
    let content: string;
    try {
        content = await readFile(inputPath, 'utf-8');
    } catch (err) {
        console.error(`Error reading ${inputPath}: ${(err as Error).message}`);
        process.exit(1);
    }

    // Migrate
    let result;
    try {
        result = await migrate(content, { id: idOverride });
    } catch (err) {
        console.error(`Migration failed: ${(err as Error).message}`);
        process.exit(1);
    }

    const mdPath = join(outputDir, `${inputName}.md`);
    const configPath = join(outputDir, 'config.json');
    const configJson = JSON.stringify(result.config, null, 2);

    if (dryRun) {
        console.log(`\n--- ${inputName}.md ---`);
        console.log(result.md);
        console.log('\n--- config.json ---');
        console.log(configJson);
        return;
    }

    // Write outputs
    await mkdir(outputDir, { recursive: true });
    await writeFile(mdPath, result.md + '\n', 'utf-8');
    await writeFile(configPath, configJson + '\n', 'utf-8');

    console.log(`✓ Wrote ${mdPath}`);
    console.log(`✓ Wrote ${configPath}`);
}

run().catch((err: unknown) => {
    console.error((err as Error).message);
    process.exit(1);
});
