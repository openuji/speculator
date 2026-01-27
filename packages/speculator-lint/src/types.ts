import type { Workspace, Document, SourcePos } from '@openuji/speculator';

/**
 * Severity level of a lint rule
 */
export type Severity = 'error' | 'warning' | 'info';
export type LintSeverity = Severity;

/**
 * Diagnostic result from a lint rule
 */
export interface LintDiagnostic {
    /** Rule code (e.g., 'no-duplicate-definition') */
    code: string;
    /** Severity level */
    severity: Severity;
    /** Diagnostic message */
    message: string;
    /** File path where the issue was found (Mandatory in the final diagnostic) */
    file: string;
    /** Position in the source file */
    sourcePos?: SourcePos;
}

/**
 * Result of running a SINGLE rule against a workspace
 */
export interface RuleResult {
    ruleName: string;
    diagnostics: LintDiagnostic[];
    executionTime: number;
    hasErrors?: boolean;
}

/**
 * Result of the entire linting process
 */
export interface LintResult {
    diagnostics: LintDiagnostic[];
    ruleResults: RuleResult[];
    totalTime: number;
    hasErrors: boolean;
}

/**
 * Options for the linter
 */
export interface LintOptions {
    config?: LinterConfig;
    workspace: Workspace;
    documentLevels: Map<string, number>;
}

/**
 * Configuration for the linter
 */
export type RuleConfigValue = Severity | 'off' | {
    enabled: boolean;
    severity?: Severity;
};

export interface LinterConfig {
    extends?: string[];
    rules: {
        [ruleCode: string]: RuleConfigValue;
    };
}
export type LintConfig = LinterConfig;

/**
 * Metadata for a rule
 */
export type RuleCategory = 'document' | 'reference' | 'workspace';

export interface RuleMetadata {
    name: string;
    code: string;
    severity: Severity;
    description: string;
    category: RuleCategory;
}

/**
 * Context provided to rules during execution
 */
export interface LintContext {
    /** The entire workspace object */
    readonly workspace: Workspace;
    /** Map of document file paths to their defined levels */
    readonly documentLevels: Map<string, number>;
    /** Current document being linted */
    readonly document: Document;
    /** Current document's level */
    readonly level: number;

    /**
     * Report a diagnostic
     */
    report(diagnostic: Omit<LintDiagnostic, 'code' | 'severity'>): void;
}

/**
 * Visitor implementation for a rule
 */
export interface LintVisitor {
    /**
     * Called once per document before visiting nodes
     * @param doc The document
     */
    onDocument?(doc: Document): void;
}

/**
 * Interface for a lint rule
 */
export interface LintRule {
    meta: RuleMetadata;

    /**
     * Create the rule visitor
     */
    create(context: LintContext): LintVisitor;
}
