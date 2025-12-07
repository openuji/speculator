/**
 * Preprocess Pipeline
 * 
 * Orchestrates configuration loading and include resolution.
 * This is the main entry point for the preprocess stage.
 */

import type { FileProvider } from '#src/file-provider/types';
import type {
    SourceFormat,
    SpecConfig,
    PreprocessedSpec,
    PreprocessResult,
    Diagnostic,
} from '#src/preprocess/types';
import { inferFormat } from '#src/preprocess/types';
import { loadRespecConfig, normalizeRespecConfig, createDefaultConfig } from '#src/preprocess/config/index';
import { resolveIncludes } from '#src/preprocess/include/index';

/**
 * Options for preprocessing a specification
 */
export interface PreprocessOptions {
    /** Path to entry file (format.md or format.html) */
    entry: string;

    /** Optional explicit format (inferred from extension if not provided) */
    entryFormat?: SourceFormat;

    /** Path to config file (optional) */
    configPath?: string;

    /** File provider for reading files */
    fileProvider: FileProvider;
}

/**
 * Preprocess a specification document
 * 
 * Loads configuration (if provided) and resolves all includes
 * to produce a PreprocessedSpec ready for parsing.
 * 
 * @param options - Preprocess options
 * @returns PreprocessResult with spec and diagnostics
 * 
 * @example
 * ```typescript
 * const result = await preprocess({
 *   entry: '/specs/my-spec/format.md',
 *   configPath: '/specs/my-spec/config.respec.json',
 *   fileProvider: new NodeFileProvider(),
 * });
 * 
 * if (result.hasErrors) {
 *   console.error('Preprocess errors:', result.diagnostics);
 * } else {
 *   // result.result contains PreprocessedSpec
 *   for (const unit of result.result.source.units) {
 *     console.log(`Processing: ${unit.file}`);
 *   }
 * }
 * ```
 */
export async function preprocess(options: PreprocessOptions): Promise<PreprocessResult> {
    const { entry, entryFormat, configPath, fileProvider } = options;
    const diagnostics: Diagnostic[] = [];

    // Canonicalize entry path
    const canonicalEntry = fileProvider.canonicalize(entry);
    const format = entryFormat ?? inferFormat(canonicalEntry);

    // Load config if provided
    let config: SpecConfig;
    if (configPath) {
        const configResult = await loadRespecConfig(fileProvider, configPath);
        diagnostics.push(...configResult.diagnostics);

        if (configResult.config) {
            config = normalizeRespecConfig(configResult.config);
        } else {
            // Config load failed, use defaults but continue
            config = createDefaultConfig();
        }
    } else {
        config = createDefaultConfig();
    }

    // Resolve includes
    const includeResult = await resolveIncludes(canonicalEntry, format, fileProvider);
    diagnostics.push(...includeResult.diagnostics);

    // Check for errors
    const hasErrors = diagnostics.some(d => d.severity === 'error');

    // Even with errors, return partial result if we have units
    if (includeResult.source.units.length === 0 && hasErrors) {
        return {
            diagnostics,
            hasErrors,
        };
    }

    return {
        result: {
            config,
            source: includeResult.source,
        },
        diagnostics,
        hasErrors,
    };
}

/**
 * Quick check if an entry file exists and is readable
 */
export async function validateEntry(
    entry: string,
    fileProvider: FileProvider
): Promise<{ valid: boolean; diagnostics: Diagnostic[] }> {
    const diagnostics: Diagnostic[] = [];
    const canonicalEntry = fileProvider.canonicalize(entry);

    try {
        await fileProvider.readText(canonicalEntry);
        return { valid: true, diagnostics };
    } catch {
        diagnostics.push({
            severity: 'error',
            code: 'include-not-found',
            message: `Entry file not found: ${canonicalEntry}`,
            file: canonicalEntry,
        });
        return { valid: false, diagnostics };
    }
}
