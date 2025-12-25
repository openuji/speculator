#!/usr/bin/env node

import { Command } from 'commander';
import { renderRespec, validateSpec } from './index.js';
import type { RenderConfig } from './model.js';

const program = new Command();

program
    .name('render-respec')
    .description('Generate ReSpec-compatible HTML from specification source files')
    .version('0.1.0');

/**
 * Render command
 */
program
    .command('render')
    .description('Render specification to ReSpec HTML')
    .requiredOption('-i, --input <path>', 'Path to spec source file (HTML or Markdown)')
    .option('-c, --config <path>', 'Path to config.respec.json')
    .requiredOption('-o, --output <path>', 'Output HTML file path')
    .option('-l, --lint-config <path>', 'Path to .speculatorlintrc.json')
    .option('-s, --strict', 'Fail on any errors', false)
    .action(async (options) => {
        const config: RenderConfig = {
            input: options.input,
            config: options.config,
            output: options.output,
            lintConfig: options.lintConfig,
            strict: options.strict,
        };

        console.log('🔧 Rendering ReSpec HTML...');
        console.log(`   Input: ${config.input}`);
        if (config.config) {
            console.log(`   Config: ${config.config}`);
        }
        console.log(`   Output: ${config.output}`);

        const result = await renderRespec(config);

        if (result.success) {
            console.log('\n✅ Render successful!\n');
            console.log(`Generated: ${result.outputPath}`);

            if (result.diagnostics && result.diagnostics.length > 0) {
                console.log('\n📋 Diagnostics:');
                const errorCount = result.diagnostics.filter(d => d.severity === 'error').length;
                const warningCount = result.diagnostics.filter(d => d.severity === 'warning').length;
                console.log(`   ${errorCount} error(s), ${warningCount} warning(s)`);

                if (config.strict && errorCount > 0) {
                    console.error('\n❌ Strict mode: failing due to errors');
                    process.exit(1);
                }
            }
        } else {
            console.error('\n❌ Render failed:\n');
            result.errors?.forEach(error => console.error(`   ${error}`));
            process.exit(1);
        }
    });

/**
 * Validate command
 */
program
    .command('validate')
    .description('Validate specification without rendering')
    .requiredOption('-i, --input <path>', 'Path to spec source file')
    .option('-c, --config <path>', 'Path to config.respec.json')
    .action(async (options) => {
        console.log('🔍 Validating specification...');
        console.log(`   Input: ${options.input}`);

        const result = await validateSpec(options.input, options.config);

        if (result.success) {
            console.log('\n✅ Validation successful!');

            if (result.diagnostics && result.diagnostics.length > 0) {
                const warningCount = result.diagnostics.filter(d => d.severity === 'warning').length;
                const infoCount = result.diagnostics.filter(d => d.severity === 'info').length;
                console.log(`   ${warningCount} warning(s), ${infoCount} info message(s)`);
            } else {
                console.log('   No issues found');
            }
        } else {
            console.error('\n❌ Validation failed:\n');
            if (result.diagnostics) {
                result.diagnostics
                    .filter(d => d.severity === 'error')
                    .forEach(d => console.error(`   [${d.code}] ${d.message}`));
            }
            result.errors?.forEach(error => console.error(`   ${error}`));
            process.exit(1);
        }
    });

program.parse();
