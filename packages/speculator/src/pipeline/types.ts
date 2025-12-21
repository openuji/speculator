import type {
    Workspace,
    Document,
    IndexDefinitionEntry,
    IndexBiblioEntry,
    Indexes1 as GlobalIndexAST,
} from '#src/types/ast.generated';

// Re-export the core AST types for convenience
export type { Workspace, Document, IndexDefinitionEntry, IndexBiblioEntry, GlobalIndexAST };


/**
 * Aggregated index for runtime lookups during postprocess phases.

 * Uses Maps for O(1) term resolution.
 */
export interface RuntimeGlobalIndex {
    /** Map of normalized term -> definitions */
    definitions: Map<string, IndexDefinitionEntry[]>;
    /** Map of key -> bibliography entry */
    bibliography: Map<string, IndexBiblioEntry>;
}

/**
 * Runtime workspace container used during pipeline execution.
 */
export interface RuntimeWorkspace {
    /** Documents in the workspace, keyed by their canonical entry path */
    documents: Map<string, Document>;
    /** Aggregated index for cross-document resolution */
    globalIndex: RuntimeGlobalIndex;
}



// ============================================================================
// Phase Definitions
// ============================================================================

/**
 * Postprocess pipeline phases in execution order.
 * 
 * Note: Parsing is a separate stage before postprocess, not a plugin phase.
 */
export type PostprocessPhase = 'transform' | 'resolve' | 'index' | 'compute' | 'render';

/**
 * Ordered list of postprocess phases for iteration
 */
export const POSTPROCESS_PHASES: PostprocessPhase[] = ['transform', 'index', 'resolve', 'compute', 'render'];

/**
 * @deprecated Use PostprocessPhase instead
 */
export type Phase = PostprocessPhase;

/**
 * @deprecated Use POSTPROCESS_PHASES instead
 */
export const PHASES: Phase[] = POSTPROCESS_PHASES;

// ============================================================================
// Phase Context Types
// ============================================================================

export interface TransformContext {
    readonly document: Document;
    readonly workspace?: RuntimeWorkspace;
}

export interface IndexContext {
    readonly document: Document;
    readonly workspace?: RuntimeWorkspace;
}

export interface ResolveContext {
    readonly document: Document;
    readonly workspace?: RuntimeWorkspace;
}

export interface ComputeContext {
    readonly document: Document;
    readonly workspace?: RuntimeWorkspace;
}

export interface RenderContext {
    readonly document: Document;
    readonly workspace?: RuntimeWorkspace;
}



// ============================================================================
// Plugin Interface (Postprocess Only)
// ============================================================================

/**
 * Postprocess plugin interface.
 * 
 * Plugins register hooks for postprocess phases only.
 * Parsing is handled separately by parser modules in src/parse/.
 */
export interface Plugin {
    /** Unique plugin name */
    name: string;

    /**
     * Optional ordering per phase.
     * Lower numbers run first. Default is 100.
     */
    order?: Partial<Record<PostprocessPhase, number>>;

    /** Transform phase hook */
    transform?(ctx: TransformContext): Promise<void>;

    /** Index phase hook (runs before resolve to build indexes) */
    index?(ctx: IndexContext): Promise<void>;

    /** Resolve phase hook (uses indexes) */
    resolve?(ctx: ResolveContext): Promise<void>;

    /** Compute phase hook */
    compute?(ctx: ComputeContext): Promise<void>;

    /** Render phase hook */
    render?(ctx: RenderContext): Promise<void>;
}

// ============================================================================
// Pipeline Options & Results
// ============================================================================

/**
 * Options for the speculate() entrypoint
 */
export interface SpeculateOptions {
    /** Path to entry file (format.md or format.html) */
    entry: string;

    /** Optional path to config file (e.g., config.respec.json) */
    configPath?: string;

    /** Plugins to execute during postprocess phases */
    plugins: Plugin[];

    /** File provider for reading files (defaults to NodeFileProvider) */
    fileProvider?: import('#src/file-provider/types').FileProvider;
}

/**
 * Result from speculate()
 */
export interface SpeculateResult {
    /** The root Workspace AST */
    workspace?: Workspace;

    /** Collected diagnostics */
    diagnostics: SpeculateDiagnostic[];

    /** Quick error check */
    hasErrors: boolean;
}


/**
 * Diagnostic from any phase
 */
export interface SpeculateDiagnostic {
    phase: 'preprocess' | 'parse' | PostprocessPhase;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    file?: string;
    sourcePos?: import('#src/types/ast.generated').SourcePos;
}

