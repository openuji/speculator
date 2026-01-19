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
} from '#src/preprocess/types';
import { inferFormat } from '#src/preprocess/types';
import { loadConfig, normalizeConfig, createDefaultConfig, ConfigLoadError } from '#src/preprocess/config/index';
import { resolveIncludes, IncludeResolveError } from '#src/preprocess/include/index';

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
 * Error thrown when preprocessing fails
 */
export class PreprocessError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly path?: string
    ) {
        super(message);
        this.name = 'PreprocessError';
    }
}

/**
 * Preprocess a specification document
 * 
 * Loads configuration (if provided) and resolves all includes
 * to produce a PreprocessedSpec ready for parsing.
 * 
 * @param options - Preprocess options
 * @returns PreprocessedSpec with config and source
 * @throws PreprocessError on failure
 * 
 * @example
 * ```typescript
 * const spec = await preprocess({
 *   entry: '/specs/my-spec/format.md',
 *   configPath: '/specs/my-spec/config.json',
 *   fileProvider: new NodeFileProvider(),
 * });
 * 
 * // spec contains PreprocessedSpec
 * for (const unit of spec.source.units) {
 *   console.log(`Processing: ${unit.file}`);
 * }
 * ```
 */
export async function preprocess(options: PreprocessOptions): Promise<PreprocessedSpec> {
    const { entry, entryFormat, configPath, fileProvider } = options;

    // Canonicalize entry path
    const canonicalEntry = fileProvider.canonicalize(entry);
    const format = entryFormat ?? inferFormat(canonicalEntry);

    // Load config if provided
    let config: SpecConfig;
    if (configPath) {
        try {
            const docConfig = await loadConfig(fileProvider, configPath);
            config = normalizeConfig(docConfig);
        } catch (error) {
            if (error instanceof ConfigLoadError) {
                throw new PreprocessError(error.message, error.code, error.path);
            }
            throw error;
        }
    } else {
        config = createDefaultConfig();
    }

    // Resolve includes
    let source;
    try {
        source = await resolveIncludes(canonicalEntry, format, fileProvider);
    } catch (error) {
        if (error instanceof IncludeResolveError) {
            throw new PreprocessError(error.message, error.code, error.path);
        }
        throw error;
    }

    return {
        config,
        source,
    };
}

/**
 * Quick check if an entry file exists and is readable
 * @throws PreprocessError if entry file not found
 */
export async function validateEntry(
    entry: string,
    fileProvider: FileProvider
): Promise<void> {
    const canonicalEntry = fileProvider.canonicalize(entry);

    try {
        await fileProvider.readText(canonicalEntry);
    } catch {
        throw new PreprocessError(
            `Entry file not found: ${canonicalEntry}`,
            'entry-not-found',
            canonicalEntry
        );
    }
}
