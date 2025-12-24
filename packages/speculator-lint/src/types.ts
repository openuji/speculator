/**
 * Core types for @openuji/speculator-lint
 * 
 * Defines the rule-based linting architecture for Speculator workspace AST.
 */

import type {
    Workspace,
    Document,
    IndexDefinitionEntry,
    InlineReference,
    SourcePos
} from '@openuji/speculator';

/**
 * Diagnostic severity levels
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Rule category for organization
 */
export type RuleCategory = 'workspace' | 'document' | 'reference' | 'custom';

/**
 * Diagnostic produced by a lint rule
 */
export interface LintDiagnostic {
    /** Rule code (e.g., 'no-redefinition') */
    code: string;
    /** Severity level */
    severity: Severity;
    /** Diagnostic message */
    message: string;
    /** File where the issue was found */
    file?: string;
    /** Source position in the file */
    sourcePos?: SourcePos;
}

/**
 * Context provided to lint rules
 */
export interface LintContext {
    /** Current workspace being linted */
    readonly workspace: Workspace;
    /** Map of document path -> level (0 is highest) */
    readonly documentLevels: Map<string, number>;
    /** Current document being processed */
    readonly document: Document;
    /** Current document's level */
    readonly level: number;

    /**
     * Report a diagnostic
     */
    report(diagnostic: Omit<LintDiagnostic, 'code' | 'severity'>): void;
}

/**
 * Visitor pattern for AST traversal
 * Rules implement the hooks they're interested in
 */
export interface LintVisitor {
    /**
     * Called for each definition in the document
     * @param entry The definition entry
     * @param allEntriesForTerm All entries for this normalized term across the workspace
     */
    onDefinition?(entry: IndexDefinitionEntry, allEntriesForTerm: IndexDefinitionEntry[]): void;

    /**
     * Called for each reference in the document
     * @param ref The reference node
     * @param target The resolved target definition (null if unresolved)
     */
    onReference?(ref: InlineReference, target: IndexDefinitionEntry | null): void;

    /**
     * Called once per document before visiting nodes
     * @param doc The document
     */
    onDocument?(doc: Document): void;
}

/**
 * Rule metadata
 */
export interface RuleMetadata {
    /** Unique rule name (e.g., 'no-redefinition') */
    name: string;
    /** Diagnostic code used in reports */
    code: string;
    /** Default severity */
    severity: Severity;
    /** Human-readable description */
    description: string;
    /** Rule category */
    category: RuleCategory;
}

/**
 * Lint rule interface
 */
export interface LintRule {
    /** Rule metadata */
    meta: RuleMetadata;

    /**
     * Create a visitor for this rule
     * @param context Lint context
     * @returns Visitor implementation
     */
    create(context: LintContext): LintVisitor;
}

/**
 * Configuration for a single rule
 */
export type RuleConfigValue =
    | 'off'
    | 'error'
    | 'warning'
    | 'info'
    | [Severity, Record<string, unknown>?]; // For future rule options

/**
 * Linter configuration
 */
export interface LintConfig {
    /** Rule configurations by rule name */
    rules?: Record<string, RuleConfigValue>;
    /** Configurations to extend */
    extends?: string[];
}

/**
 * Result from a single rule execution
 */
export interface RuleResult {
    /** Rule name */
    ruleName: string;
    /** Diagnostics produced by this rule */
    diagnostics: LintDiagnostic[];
    /** Execution time in milliseconds */
    executionTime: number;
}

/**
 * Overall lint result
 */
export interface LintResult {
    /** All diagnostics from all rules */
    diagnostics: LintDiagnostic[];
    /** Quick check for errors */
    hasErrors: boolean;
    /** Results per rule */
    ruleResults: Map<string, RuleResult>;
    /** Total execution time */
    totalTime: number;
}

/**
 * Options for running the linter
 */
export interface LintOptions {
    /** Workspace to lint */
    workspace: Workspace;
    /** Document level mapping */
    documentLevels: Map<string, number>;
    /** Optional configuration override */
    config?: LintConfig;
}
