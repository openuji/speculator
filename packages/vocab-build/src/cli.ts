#!/usr/bin/env node

import { Command } from 'commander';
import { buildVocab, validateVocab } from './index.js';
import type { BuildConfig } from './model.js';
import { readFile } from 'fs/promises';

const program = new Command();

program
    .name('vocab-build')
    .description('Generate publishable semantic web vocabulary assets from JSON-LD schema source files')
    .version('0.1.0');

/**
 * Build command
 */
program
    .command('build')
    .description('Build vocabulary assets')
    .requiredOption('-i, --input <path>', 'Path to vocab source file')
    .option('-o, --out <dir>', 'Output directory', 'dist')
    .requiredOption('-m, --module <core|ui>', 'Module name (core or ui)')
    .requiredOption('--mode <ED|TR>', 'Build mode (ED or TR)')
    .option('-v, --version <semver>', 'Version for TR mode (x.y.z)')
    .option('-f, --force', 'Overwrite existing TR snapshot', false)
    .option('-b, --base-url <url>', 'Base URL for deployment')
    .option('-g, --git', 'Use git commit hash and date', false)
    .option('-r, --redirects <type>', 'Redirect type (none|netlify|cloudflare|json)', 'netlify')
    .option('-s, --strict', 'Fail on unknown fields', false)
    .action(async (options) => {
        const config: BuildConfig = {
            input: options.input,
            output: options.out,
            module: options.module as 'core' | 'ui',
            mode: options.mode as 'ED' | 'TR',
            version: options.version,
            force: options.force,
            baseUrl: options.baseUrl,
            git: options.git,
            redirects: options.redirects as 'none' | 'netlify' | 'cloudflare' | 'json',
            strict: options.strict,
        };

        console.log('🏗️  Building vocabulary...');
        console.log(`   Input: ${config.input}`);
        console.log(`   Module: ${config.module}`);
        console.log(`   Mode: ${config.mode}`);
        if (config.version) {
            console.log(`   Version: ${config.version}`);
        }

        const result = await buildVocab(config);

        if (result.success) {
            console.log('\n✅ Build successful!\n');
            console.log('Generated files:');
            result.files.forEach(file => console.log(`   - ${file}`));
        } else {
            console.error('\n❌ Build failed:\n');
            result.errors?.forEach(error => console.error(`   ${error}`));
            process.exit(1);
        }
    });

/**
 * Validate command
 */
program
    .command('validate')
    .description('Validate vocabulary source file')
    .requiredOption('-i, --input <path>', 'Path to vocab source file')
    .action(async (options) => {
        console.log('🔍 Validating vocabulary source...');
        console.log(`   Input: ${options.input}`);

        const result = await validateVocab(options.input);

        if (result.success) {
            console.log('\n✅ Validation successful!');
        } else {
            console.error('\n❌ Validation failed:\n');
            result.errors?.forEach(error => console.error(`   ${error}`));
            process.exit(1);
        }
    });

/**
 * Release command (convenience)
 */
program
    .command('release')
    .description('Release a new TR version (builds TR + updates latest + generates redirects)')
    .requiredOption('-i, --input <path>', 'Path to vocab source file')
    .option('-o, --out <dir>', 'Output directory', 'dist')
    .option('-b, --base-url <url>', 'Base URL for deployment')
    .action(async (options) => {
        console.log('🚀 Releasing vocabulary...');

        // Read source to get version and module
        const sourceContent = await readFile(options.input, 'utf-8');
        const sourceData = JSON.parse(sourceContent);

        if (!sourceData.version) {
            console.error('❌ Source file must include a version for release');
            process.exit(1);
        }

        if (sourceData.status !== 'TR') {
            console.error('❌ Source file status must be "TR" for release');
            process.exit(1);
        }

        const config: BuildConfig = {
            input: options.input,
            output: options.out,
            module: sourceData.module,
            mode: 'TR',
            version: sourceData.version,
            baseUrl: options.baseUrl,
            redirects: 'netlify',
            force: false,
            git: false,
            strict: false,
        };

        const result = await buildVocab(config);

        if (result.success) {
            console.log('\n✅ Release successful!\n');
            console.log(`Released ${config.module} v${config.version}`);
            console.log('\nGenerated files:');
            result.files.forEach(file => console.log(`   - ${file}`));
        } else {
            console.error('\n❌ Release failed:\n');
            result.errors?.forEach(error => console.error(`   ${error}`));
            process.exit(1);
        }
    });

program.parse();
