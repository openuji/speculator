/**
 * Pipeline Types
 * 
 * Unified plugin interface and phase definitions.
 * Plugins register handlers that execute during specific pipeline phases.
 */

import type { Element } from 'hast';
import type { RootContent as MdastRootContent } from 'mdast';
import type { SpeculatorASTSchema as Document, Block } from '#src/types/ast.generated';

// Re-export parse context from registry for plugins
export type {
    ParseContext,
    NodeWithPosition,
    BlockHandlerResult,
    InlineHandlerResult,
} from '#src/parse/registry';

// ============================================================================
// Phase Definitions
// ============================================================================

/**
 * Pipeline phases in execution order.
 * Preprocess runs before plugins; it's not a plugin phase.
 */
export type Phase = 'parse' | 'transform' | 'resolve' | 'index' | 'compute' | 'render';

/**
 * Ordered list of phases for iteration
 */
export const PHASES: Phase[] = ['parse', 'transform', 'resolve', 'index', 'compute', 'render'];

// ============================================================================
// Future Phase Context Types (Stubs)
// ============================================================================

/**
 * Context for transform phase
 */
export interface TransformContext {
    readonly document: Document;
}

/**
 * Context for resolve phase
 */
export interface ResolveContext {
    readonly document: Document;
}

/**
 * Context for index phase
 */
export interface IndexContext {
    readonly document: Document;
}

/**
 * Context for compute phase
 */
export interface ComputeContext {
    readonly document: Document;
}

/**
 * Context for render phase
 */
export interface RenderContext {
    readonly document: Document;
}

// ============================================================================
// Plugin Interface
// ============================================================================

/**
 * Unified plugin interface.
 * 
 * Plugins may register hooks for any phase. The pipeline runner
 * executes hooks in phase order, with plugins sorted by their
 * declared order within each phase.
 */
export interface Plugin {
    /** Unique plugin name */
    name: string;

    /**
     * Optional ordering per phase.
     * Lower numbers run first. Default is 100.
     */
    order?: Partial<Record<Phase, number>>;

    /**
     * Parse phase handlers.
     * 
     * Plugins implement HTML and/or Markdown handlers that receive
     * IR nodes and emit AST nodes via the context.
     */
    parse?: {
        /** Handle HTML elements */
        html?: {
            /** Tag names this handler processes */
            tags: string[];
            /** Handle block-level element */
            handleBlock?(element: Element, ctx: import('#src/parse/registry').ParseContext): import('#src/parse/registry').BlockHandlerResult;
            /** Handle inline element */
            handleInline?(element: Element, ctx: import('#src/parse/registry').ParseContext): import('#src/parse/registry').InlineHandlerResult;
        };
        /** Handle Markdown nodes */
        markdown?: {
            /** Node types this handler processes */
            nodeTypes: string[];
            /** Handle block-level node */
            handleBlock?(node: MdastRootContent, ctx: import('#src/parse/registry').ParseContext): Block | null;
            /** Handle inline node */
            handleInline?(node: MdastRootContent, ctx: import('#src/parse/registry').ParseContext): import('#src/parse/registry').InlineHandlerResult;
        };
    };

    /** Transform phase hook */
    transform?(ctx: TransformContext): Promise<void>;

    /** Resolve phase hook */
    resolve?(ctx: ResolveContext): Promise<void>;

    /** Index phase hook */
    index?(ctx: IndexContext): Promise<void>;

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

    /** Plugins to execute during pipeline phases */
    plugins: Plugin[];

    /** File provider for reading files (defaults to NodeFileProvider) */
    fileProvider?: import('#src/file-provider/types').FileProvider;
}

/**
 * Result from speculate()
 */
export interface SpeculateResult {
    /** Parsed document AST */
    document?: Document;

    /** Collected diagnostics */
    diagnostics: SpeculateDiagnostic[];

    /** Quick error check */
    hasErrors: boolean;
}

/**
 * Diagnostic from any phase
 */
export interface SpeculateDiagnostic {
    phase: 'preprocess' | Phase;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    file?: string;
    sourcePos?: import('#src/types/ast.generated').SourcePos;
}
