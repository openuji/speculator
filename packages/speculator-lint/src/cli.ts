#!/usr/bin/env node

/**
 * CLI for speculator-lint
 * 
 * Usage:
 *   speculator-lint <workspace.json> [--config <path>]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Workspace } from '@openuji/speculator';
import { SpeculatorLinter } from './linter.js';
import { builtInRules } from './rules/index.js';
import { loadConfig, loadConfigFromDefaults, recommendedConfig } from './config.js';
import type { LintConfig } from './types.js';

interface CliArgs {
    workspacePath: string;
    configPath?: string;
    help?: boolean;
}

function parseArgs(): CliArgs {
    const args = process.argv.slice(2);
    const result: CliArgs = {
        workspacePath: '',
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else if (arg === '--config' || arg === '-c') {
            result.configPath = args[++i];
        } else if (!arg.startsWith('-')) {
            result.workspacePath = arg;
        }
    }

    return result;
}

function showHelp() {
    console.log(`
speculator-lint - Lint Speculator workspace AST

Usage:
  speculator-lint <workspace.json> [options]

Options:
  --config, -c <path>    Path to configuration file
  --help, -h             Show this help message

Examples:
  speculator-lint workspace.json
  speculator-lint workspace.json --config .speculatorlintrc.json
`);
}

function formatDiagnostic(diagnostic: any): string {
    const severity = diagnostic.severity.toUpperCase();
    const code = diagnostic.code;
    const file = diagnostic.file || '<unknown>';
    const line = diagnostic.sourcePos?.line || '?';
    const col = diagnostic.sourcePos?.column || '?';

    return `${severity} [${code}] ${file}:${line}:${col}\n  ${diagnostic.message}`;
}

async function main() {
    const args = parseArgs();

    if (args.help || !args.workspacePath) {
        showHelp();
        process.exit(args.help ? 0 : 1);
    }

    try {
        // Load workspace
        const workspacePath = resolve(args.workspacePath);
        const workspaceJson = readFileSync(workspacePath, 'utf-8');
        const workspace = JSON.parse(workspaceJson) as Workspace;

        // Build document levels map
        const documentLevels = new Map<string, number>();
        workspace.documents.forEach((doc, index) => {
            const path = doc.sourcePos?.file || '';
            if (path) {
                documentLevels.set(path, index);
            }
        });

        // Load configuration
        let config: LintConfig;
        if (args.configPath) {
            config = loadConfig(args.configPath);
            console.log(`Using configuration from: ${args.configPath}`);
        } else {
            const defaultConfigLoaded = loadConfigFromDefaults();
            if (defaultConfigLoaded) {
                config = defaultConfigLoaded;
                console.log('Using configuration from default location');
            } else {
                config = recommendedConfig;
                console.log('Using recommended configuration (no config file found)');
            }
        }

        // Create linter
        const linter = new SpeculatorLinter(builtInRules);

        // Run linter
        console.log('\nLinting workspace...\n');
        const result = await linter.lint({
            workspace,
            documentLevels,
            config
        });

        // Output diagnostics
        if (result.diagnostics.length === 0) {
            console.log('✓ No issues found');
        } else {
            for (const diagnostic of result.diagnostics) {
                console.log(formatDiagnostic(diagnostic));
                console.log('');
            }

            const errorCount = result.diagnostics.filter(d => d.severity === 'error').length;
            const warningCount = result.diagnostics.filter(d => d.severity === 'warning').length;

            console.log(`Found ${errorCount} error(s), ${warningCount} warning(s)`);
        }

        // Show timing
        console.log(`\nCompleted in ${result.totalTime.toFixed(2)}ms`);

        // Exit with error code if errors found
        process.exit(result.hasErrors ? 1 : 0);

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

main();
