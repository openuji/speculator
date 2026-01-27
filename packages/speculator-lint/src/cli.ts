#!/usr/bin/env node

/**
 * CLI for speculator-lint
 * 
 * Usage:
 *   speculator-lint <workspace.json> [--config <path>]
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { 
    SpeculatorPipeline, 
    corePlugins, 
    NodeFileProvider, 
    buildWorkspaces 
} from '@openuji/speculator';
import type { Workspace, WorkspaceConfig, BuildWorkspacesResult } from '@openuji/speculator';
import { SpeculatorLinter } from './linter.js';
import { builtInRules } from './rules/index.js';
import { loadConfig, loadConfigFromDefaults, recommendedConfig } from './config.js';
import type { LintConfig, LintDiagnostic } from './types.js';

interface CliArgs {
    workspacePath: string;
    configPath?: string;
    help?: boolean;
    files: string[];
}

function parseArgs(): CliArgs {
    const args = process.argv.slice(2);
    const result: CliArgs = {
        workspacePath: '',
        files: []
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else if (arg === '--config' || arg === '-c') {
            result.configPath = args[++i];
        } else if (!arg.startsWith('-')) {
            if (!result.workspacePath) {
                result.workspacePath = arg;
            } else {
                result.files.push(resolve(arg));
            }
        }
    }

    return result;
}

function showHelp() {
    console.log(`
speculator-lint - Lint Speculator workspace AST

Usage:
  speculator-lint <workspace.json> [files...] [options]

Options:
  --config, -c <path>    Path to configuration file
  --help, -h             Show this help message

Examples:
  speculator-lint workspace.json
  speculator-lint workspace.json spec/index.md spec/other.html
  speculator-lint workspace.json --config .speculatorlintrc.json
`);
}

function formatDiagnostic(diagnostic: LintDiagnostic): string {
    const severity = diagnostic.severity.toUpperCase();
    const code = diagnostic.code;
    const file = diagnostic.file;
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
        // Load workspace configuration
        const workspacePath = resolve(args.workspacePath);
        const workspaceContent = readFileSync(workspacePath, 'utf-8');
        
        let workspacesToLint: Record<string, Workspace> = {};

        if (args.workspacePath.endsWith('.workspace.json')) {
            const workspaceConfig = JSON.parse(workspaceContent) as WorkspaceConfig;
            const fileProvider = new NodeFileProvider();
            
            const buildResult = await buildWorkspaces(
                workspaceConfig,
                fileProvider,
                workspacePath
            );

            if (buildResult.errors.length > 0) {
                for (const error of buildResult.errors) {
                    console.error(`Workspace Error: ${error}`);
                }
                process.exit(1);
            }

            workspacesToLint = buildResult.workspaces;
        } else {
            // Legacy/Direct AST JSON loading (single anonymous workspace)
            workspacesToLint['default'] = JSON.parse(workspaceContent) as Workspace;
        }

        // Load linter configuration
        let config: LintConfig;
        if (args.configPath) {
            config = loadConfig(args.configPath);
            console.log(`Using linter configuration from: ${args.configPath}`);
        } else {
            const defaultConfigLoaded = loadConfigFromDefaults();
            if (defaultConfigLoaded) {
                config = defaultConfigLoaded;
                console.log('Using linter configuration from default location');
            } else {
                config = recommendedConfig;
                console.log('Using recommended linter configuration (no config file found)');
            }
        }

        // Create linter
        const linter = new SpeculatorLinter(builtInRules);
        const allDiagnostics: LintDiagnostic[] = [];
        let totalTime = 0;

        // Lint each workspace separately
        console.log('\nLinting workspaces...\n');
        for (const [name, workspace] of Object.entries(workspacesToLint)) {
            if (Object.keys(workspacesToLint).length > 1) {
                console.log(`- [${name}]`);
            }

            // Build document levels map
            const documentLevels = new Map<string, number>();
            workspace.documents.forEach((doc, index) => {
                const path = doc.sourcePos?.file || '';
                if (path) {
                    documentLevels.set(path, index);
                }
            });

            const result = await linter.lint({
                workspace,
                documentLevels,
                config
            });

            allDiagnostics.push(...result.diagnostics);
            totalTime += result.totalTime;
        }

        // Output diagnostics
        if (allDiagnostics.length === 0) {
            console.log('✓ No issues found');
        } else {
            for (const diagnostic of allDiagnostics) {
                console.log(formatDiagnostic(diagnostic));
                console.log('');
            }

            const errorCount = allDiagnostics.filter(d => d.severity === 'error').length;
            const warningCount = allDiagnostics.filter(d => d.severity === 'warning').length;

            console.log(`Found ${errorCount} error(s), ${warningCount} warning(s) across ${Object.keys(workspacesToLint).length} workspace(s)`);
        }

        // Show timing
        console.log(`\nCompleted in ${totalTime.toFixed(2)}ms`);

        // Exit with error code if any errors found
        const hasErrors = allDiagnostics.some(d => d.severity === 'error');
        process.exit(hasErrors ? 1 : 0);

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

main();
