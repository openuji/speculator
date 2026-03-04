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
import { fetchBoilerplate, renderBoilerplateFile, SLOT_HEADINGS } from './boilerplate.js';

function printUsage() {
    console.log(`
Usage: bikeshed-migrate <input.bs> [options]

Options:
  --out <dir>         Output directory (default: same directory as input file)
  --id <id>           Override document ID in config.json
  --no-boilerplate    Skip fetching boilerplate overrides (includes/*.md)
  --dry-run           Print outputs to stdout without writing files
  --help              Show this help message
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
    let skipBoilerplate = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--out' || arg === '-o') {
            outDir = args[++i];
        } else if (arg === '--id') {
            idOverride = args[++i];
        } else if (arg === '--dry-run') {
            dryRun = true;
        } else if (arg === '--no-boilerplate') {
            skipBoilerplate = true;
        } else if (!arg.startsWith('-')) {
            if (!inputFile) {
                inputFile = arg;
            } else if (!outDir) {
                outDir = arg;
            } else {
                console.error(`Unexpected argument: ${arg}`);
                printUsage();
                process.exit(1);
            }
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

    const styles = result.resources.filter(r => r.type === 'style').map(r => r.content).join('\n\n');
    const scripts = result.resources.filter(r => r.type === 'script').map(r => r.content).join('\n\n');
    const stylePath = styles ? join(outputDir, 'style.css') : null;
    const scriptPath = scripts ? join(outputDir, 'script.js') : null;

    // Fetch boilerplate includes by default when Group + Status are present
    const group = result.config.respec?.group;
    const status = result.config.respec?.specStatus;
    let boilerplate: Awaited<ReturnType<typeof fetchBoilerplate>> | null = null;

    if (!skipBoilerplate && group && status) {
        console.log(`Fetching boilerplate for group=${group}, status=${status}…`);
        boilerplate = await fetchBoilerplate(group, status);
    }

    // Inject copyright into config (not an include file)
    if (boilerplate?.copyright) {
        result.config.respec ??= {};
        result.config.respec.copyright = renderBoilerplateFile('copyright', boilerplate.copyright).trim();
    }

    const configJson = JSON.stringify(result.config, null, 2);

    if (dryRun) {
        console.log(`\n--- ${inputName}.md ---`);
        console.log(result.md);
        console.log('\n--- config.json ---');
        console.log(configJson);
        if (styles) { console.log('\n--- style.css ---'); console.log(styles); }
        if (scripts) { console.log('\n--- script.js ---'); console.log(scripts); }
        if (result.abstract) { console.log('\n--- includes/abstract.md ---'); console.log(`${SLOT_HEADINGS['abstract']}\n\n${result.abstract.trim()}`); }
        if (boilerplate) {
            for (const [slot, resolved] of Object.entries(boilerplate)) {
                if (slot === 'copyright') continue;
                console.log(`\n--- includes/${slot}.md --- (${resolved.source})`);
                console.log(resolved.content);
            }
        }
        return;
    }

    // Write outputs
    await mkdir(outputDir, { recursive: true });
    await writeFile(mdPath, result.md + '\n', 'utf-8');
    await writeFile(configPath, configJson + '\n', 'utf-8');

    console.log(`✓ Wrote ${mdPath}`);
    console.log(`✓ Wrote ${configPath}`);

    if (stylePath) {
        await writeFile(stylePath, styles + '\n', 'utf-8');
        console.log(`✓ Wrote ${stylePath}  (${result.resources.filter(r => r.type === 'style').length} style block(s))`);
    }
    if (scriptPath) {
        await writeFile(scriptPath, scripts + '\n', 'utf-8');
        console.log(`✓ Wrote ${scriptPath}  (${result.resources.filter(r => r.type === 'script').length} script block(s))`);
    }

    // Write includes/abstract.md from metadata Abstract: field (always, not tied to boilerplate)
    if (result.abstract) {
        const abstract = result.abstract;
        const includesDir = join(outputDir, 'includes');
        await mkdir(includesDir, { recursive: true });
        const abstractPath = join(includesDir, 'abstract.md');
        await writeFile(abstractPath, `${SLOT_HEADINGS['abstract']}\n\n${abstract.trim()}\n`, 'utf-8');
        console.log(`✓ Wrote ${abstractPath}  (from metadata Abstract:)`);
    }

    if (boilerplate) {
        const includesDir = join(outputDir, 'includes');
        await mkdir(includesDir, { recursive: true });
        for (const [slot, resolved] of Object.entries(boilerplate)) {
            if (!resolved || slot === 'copyright') continue; // copyright goes into config.json
            const filePath = join(includesDir, `${slot}.md`);
            await writeFile(filePath, renderBoilerplateFile(slot, resolved), 'utf-8');
            console.log(`✓ Wrote ${filePath}  (${resolved.source})`);
        }
        const missing = (['status', 'logo', 'conformance'] as const).filter(
            s => !(s in boilerplate!),
        );
        if (missing.length > 0) {
            console.warn(`⚠ No boilerplate found for: ${missing.join(', ')}`);
        }
    }
}

run().catch((err: unknown) => {
    console.error((err as Error).message);
    process.exit(1);
});
