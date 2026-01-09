/**
 * Preprocess Stage Types
 * 
 * Types for spec configuration loading and file composition before parsing.
 */

import type { SourcePos } from '#src/types/ast.generated';

// ============================================================================
// Source Format
// ============================================================================

/**
 * Supported input formats for spec files
 */
export type SourceFormat = 'markdown' | 'html';

/**
 * Infer format from file extension
 */
export function inferFormat(path: string): SourceFormat {
    const ext = path.split('.').pop()?.toLowerCase();
    if (ext === 'html' || ext === 'htm') {
        return 'html';
    }
    return 'markdown';
}

// ============================================================================
// Include Directives
// ============================================================================

/**
 * A parsed include directive from source content
 */
export interface IncludeDirective {
    /** Relative path as written in source (e.g., "./intro.md") */
    relativePath: string;

    /** Explicit format if specified, otherwise inferred from extension */
    format?: SourceFormat;

    /** Position of the directive in source */
    sourcePos: SourcePos;

    /** Start offset in content (for splitting) */
    startOffset: number;

    /** End offset in content (for splitting) */
    endOffset: number;
}

// ============================================================================
// Source Units
// ============================================================================

/**
 * A unit of source content with its origin file
 * 
 * The preprocess stage splits content at include points to preserve
 * sourcePos.file for each fragment. This enables accurate error reporting
 * that points to the correct file.
 */
export interface SourceUnit {
    /** Canonical file path */
    file: string;

    /** Content format */
    format: SourceFormat;

    /** Raw content (not the entire file if split at includes) */
    content: string;

    /** 
     * Display-friendly file path for error messages
     * (e.g., relative to spec root)
     */
    displayFile?: string;

    /**
     * 1-indexed line number where this unit's content starts in the source file.
     * Used to compute accurate sourcePos for parsed AST nodes.
     */
    startLine: number;
}

// ============================================================================
// Include Graph
// ============================================================================

/**
 * Edge in the include graph
 */
export interface IncludeEdge {
    /** Canonical path of included file */
    target: string;

    /** Position where include occurred */
    sourcePos: SourcePos;
}

/**
 * Include graph tracking parent→children relationships
 * Maps canonical file path to list of includes from that file
 */
export type IncludeGraph = Map<string, IncludeEdge[]>;

// ============================================================================
// Composite Source
// ============================================================================

/**
 * Composed source document from entry file and includes
 * 
 * The units array is ordered by document flow - includes are expanded
 * in-place where they appear in the source.
 */
export interface CompositeSource {
    /** Canonical path of entry file */
    entryFile: string;

    /** Format of entry file */
    entryFormat: SourceFormat;

    /** 
     * Ordered source units representing document flow.
     * Includes are expanded in-place (encounter order).
     */
    units: SourceUnit[];

    /** Include relationship graph for diagnostics */
    includeGraph: IncludeGraph;
}

// ============================================================================
// Spec Configuration
// ============================================================================

/**
 * Person entry for editors/authors
 */
export interface PersonEntry {
    name: string;
    url?: string;
    company?: string;
    companyURL?: string;
    email?: string;
}

/**
 * Normalized spec configuration
 * 
 * Internal representation derived from ReSpec-like config files.
 * All optional fields have sensible defaults applied.
 */
export interface SpecConfig {
    /** Document title */
    title?: string;

    /** Short name for URLs/references (e.g., "html", "css-grid") */
    shortName?: string;

    /** Subtitle or tagline */
    subtitle?: string;

    /** Spec status (e.g., "ED", "WD", "CR", "REC", "NOTE") */
    status?: string;

    /** Publication date (ISO 8601: YYYY-MM-DD) */
    publishDate?: string;

    /** This version URL */
    thisVersion?: string;

    /** Latest version URL */
    latestVersion?: string;

    /** Previous version URL */
    previousVersion?: string;

    /** Editor list */
    editors?: PersonEntry[];

    /** Author list */
    authors?: PersonEntry[];

    /** Abstract text (if not in document body) */
    abstract?: string;

    /** Copyright notice */
    copyright?: string;

    /** License URL */
    license?: string;

    /** Additional logos */
    logos?: Array<{ src: string; alt?: string; href?: string }>;

    /** Enable table of contents generation */
    tocEnabled?: boolean;

    /** Maximum ToC depth */
    maxTocLevel?: number;

    /** Custom specification profile/variant */
    specProfile?: string;

    /** Local bibliography entries for citation resolution */
    localBiblio?: Record<string, { title: string; url?: string }>;
}

// ============================================================================
// Preprocessed Spec
// ============================================================================

/**
 * Complete preprocessed specification ready for parsing
 */
export interface PreprocessedSpec {
    /** Normalized configuration */
    config: SpecConfig;

    /** Composed source with includes resolved */
    source: CompositeSource;
}

// ============================================================================
// Diagnostics
// ============================================================================

/**
 * Diagnostic severity levels
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Preprocess diagnostic codes
 */
export type PreprocessDiagnosticCode =
    | 'include-cycle'
    | 'include-not-found'
    | 'config-parse-error'
    | 'config-not-found'
    | 'invalid-include-directive'
    | 'unknown-format';

/**
 * Diagnostic message from preprocessing
 */
export interface Diagnostic {
    /** Severity level */
    severity: DiagnosticSeverity;

    /** Machine-readable error code */
    code: PreprocessDiagnosticCode;

    /** Human-readable message */
    message: string;

    /** File where issue occurred */
    file?: string;

    /** Position in file (if applicable) */
    sourcePos?: SourcePos;

    /** Related information (e.g., cycle path) */
    related?: Array<{
        file: string;
        message: string;
        sourcePos?: SourcePos;
    }>;
}

/**
 * Create a diagnostic helper
 */
export function createDiagnostic(
    severity: DiagnosticSeverity,
    code: PreprocessDiagnosticCode,
    message: string,
    file?: string,
    sourcePos?: SourcePos
): Diagnostic {
    return { severity, code, message, file, sourcePos };
}

// ============================================================================
// Preprocess Result
// ============================================================================

/**
 * Result of preprocessing with diagnostics
 */
export interface PreprocessResult {
    /** Preprocessed spec (may be partial if errors occurred) */
    result?: PreprocessedSpec;

    /** Diagnostics collected during preprocessing */
    diagnostics: Diagnostic[];

    /** Quick check for any errors */
    hasErrors: boolean;
}
