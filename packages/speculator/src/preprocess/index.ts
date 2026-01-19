/**
 * Preprocess Module - Public API
 * 
 * The preprocess stage handles:
 * - Loading and normalizing spec configuration
 * - Resolving includes to produce ordered SourceUnits
 * - Preserving source file information for accurate error reporting
 */

// Main orchestrator
export { preprocess, validateEntry, PreprocessError } from '#src/preprocess/pipeline';
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
    MaturityLevel,
} from '#src/preprocess/types';

export { inferFormat } from '#src/preprocess/types';

// Config submodule (for advanced use)
export {
    loadConfig,
    normalizeConfig,
    createDefaultConfig,
    ConfigLoadError,
} from '#src/preprocess/config/index';
export type { RawRespecConfig, RawPersonEntry, DocumentConfig, ResolvedDocumentConfig } from '#src/preprocess/config/index';

// Include submodule (for advanced use)
export {
    scanMarkdownIncludes,
    scanHtmlIncludes,
    resolveIncludes,
    IncludeResolveError,
} from '#src/preprocess/include/index';
