import { readFile, writeFile } from 'fs/promises';
import { speculate, corePlugins } from '@openuji/speculator';
import { SpeculatorLinter, builtInRules } from '@openuji/speculator-lint';
import type { Document } from '@openuji/speculator';
import type { LintResult, LintDiagnostic } from '@openuji/speculator-lint';
import { RenderConfigSchema, ReSpecConfigSchema, validateRenderConfig, validateReSpecConfig } from './model.js';
import type { RenderConfig, RenderResult, ReSpecConfig } from './model.js';
import { generateHTML } from './render/html.js';

export type { RenderConfig, RenderResult, ReSpecConfig };
export { validateRenderConfig, validateReSpecConfig };

/**
 * Main render function: generates ReSpec-compatible HTML from spec source
 */
export async function renderRespec(config: RenderConfig): Promise<RenderResult> {
    try {
        // Validate and parse config
        const parsedConfig = RenderConfigSchema.parse(config);

        // Load ReSpec configuration if provided
        let respecConfig: ReSpecConfig = ReSpecConfigSchema.parse({});
        if (parsedConfig.config) {
            const configContent = await readFile(parsedConfig.config, 'utf-8');
            const configData = JSON.parse(configContent);
            respecConfig = ReSpecConfigSchema.parse(configData);
        }

        // Run Speculator pipeline to build AST with indexes and resolution
        console.log('🔍 Building AST with Speculator...');
        const speculateResult = await speculate({
            entry: parsedConfig.input,
            plugins: corePlugins, // Use core plugins for transform, index, resolve
        });

        if (!speculateResult.workspace) {
            return {
                success: false,
                errors: ['Failed to build AST: workspace is undefined'],
            };
        }

        const workspace = speculateResult.workspace;

        // Build document levels map
        const documentLevels = new Map<string, number>();
        workspace.documents.forEach((doc: Document, index: number) => {
            const file = doc.sourcePos?.file || `doc-${index}`;
            documentLevels.set(file, index);
        });

        // Run Speculator-lint to collect diagnostics
        console.log('🔍 Running linter...');
        // Use built-in rules by default
        const linter = new SpeculatorLinter(builtInRules);

        const lintResult: LintResult = await linter.lint({
            workspace,
            documentLevels,
        });

        // Generate HTML using the AST, indexes, and diagnostics
        console.log('📝 Generating ReSpec HTML...');
        const html = await generateHTML(workspace, respecConfig, lintResult);

        // Write output
        await writeFile(parsedConfig.output, html, 'utf-8');

        // Format diagnostics for result
        const formattedDiagnostics = lintResult.diagnostics.map((d: LintDiagnostic) => ({
            code: d.code,
            severity: d.severity,
            message: d.message,
            file: d.file,
            line: d.sourcePos?.line,
            column: d.sourcePos?.column,
        }));

        return {
            success: true,
            outputPath: parsedConfig.output,
            diagnostics: formattedDiagnostics,
        };
    } catch (error) {
        return {
            success: false,
            errors: [error instanceof Error ? error.message : String(error)],
        };
    }
}

/**
 * Validate a spec file and config without rendering
 */
export async function validateSpec(inputPath: string, configPath?: string): Promise<RenderResult> {
    try {
        // Load ReSpec configuration if provided
        if (configPath) {
            const configContent = await readFile(configPath, 'utf-8');
            const configData = JSON.parse(configContent);
            validateReSpecConfig(configData);
        }

        // Run Speculator pipeline
        const speculateResult = await speculate({
            entry: inputPath,
            plugins: corePlugins,
        });

        if (!speculateResult.workspace) {
            return {
                success: false,
                errors: ['Failed to validate: workspace is undefined'],
            };
        }

        // Build document levels map
        const documentLevels = new Map<string, number>();
        speculateResult.workspace.documents.forEach((doc: Document, index: number) => {
            const file = doc.sourcePos?.file || `doc-${index}`;
            documentLevels.set(file, index);
        });

        // Run linter
        const linter = new SpeculatorLinter(builtInRules);
        const lintResult = await linter.lint({
            workspace: speculateResult.workspace,
            documentLevels,
        });

        const hasErrors = lintResult.diagnostics.some((d: LintDiagnostic) => d.severity === 'error');

        return {
            success: !hasErrors,
            diagnostics: lintResult.diagnostics.map((d: LintDiagnostic) => ({
                code: d.code,
                severity: d.severity,
                message: d.message,
                file: d.file,
                line: d.sourcePos?.line,
                column: d.sourcePos?.column,
            })),
        };
    } catch (error) {
        return {
            success: false,
            errors: [error instanceof Error ? error.message : String(error)],
        };
    }
}
