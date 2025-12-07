/**
 * Preprocess Module - Public API
 * 
 * The preprocess stage handles:
 * - Loading and normalizing spec configuration
 * - Resolving includes to produce ordered SourceUnits
 * - Preserving source file information for accurate error reporting
 */

// Main orchestrator
export { preprocess, validateEntry } from '#src/preprocess/pipeline';
export type { PreprocessOptions } from '#src/preprocess/pipeline';

// Core types
export type {
    SourceFormat,
    IncludeDirective,
    SourceUnit,
    IncludeGraph,
    IncludeEdge,
    CompositeSource,
    PersonEntry,
    SpecConfig,
    PreprocessedSpec,
    DiagnosticSeverity,
    PreprocessDiagnosticCode,
    Diagnostic,
    PreprocessResult,
} from '#src/preprocess/types';

export { inferFormat, createDiagnostic } from '#src/preprocess/types';

// Config submodule (for advanced use)
export {
    loadRespecConfig,
    normalizeRespecConfig,
    createDefaultConfig,
} from '#src/preprocess/config/index';
export type { RawRespecConfig, RawPersonEntry } from '#src/preprocess/config/index';

// Include submodule (for advanced use)
export {
    scanMarkdownIncludes,
    scanHtmlIncludes,
    resolveIncludes,
} from '#src/preprocess/include/index';
