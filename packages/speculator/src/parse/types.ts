/**
 * Parse Stage Types
 * 
 * Types for parsing source units into AST nodes.
 */

import type { SourceUnit, SourceFormat, SpecConfig } from '#src/preprocess/types';
import type { Section, Block, SourcePos, Document } from '#src/types/ast.generated';


// ============================================================================
// Unit Parser Interface
// ============================================================================

/**
 * Interface for format-specific unit parsers
 * 
 * Both markdown and HTML parsers implement this interface,
 * allowing the orchestrator to route units to the correct parser.
 */
export interface UnitParser {
    /** Format this parser handles */
    readonly format: SourceFormat;

    /**
     * Parse a source unit into AST blocks
     * 
     * @param unit - Source unit to parse
     * @returns Array of top-level blocks/sections
     */
    parse(unit: SourceUnit): (Section | Block)[];
}

// ============================================================================
// Parsed Spec
// ============================================================================

/**
 * Result of parsing a preprocessed spec
 */
export interface ParsedSpec {
    /** Configuration from preprocess */
    config: SpecConfig;

    /** Parsed document AST */
    document: Document;
}

// ============================================================================
// Parse Diagnostics
// ============================================================================

/**
 * Parse diagnostic codes
 */
export type ParseDiagnosticCode =
    | 'parse-error'
    | 'invalid-structure'
    | 'unsupported-element';

/**
 * Diagnostic severity levels
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Parse diagnostic message
 */
export interface ParseDiagnostic {
    severity: DiagnosticSeverity;
    code: ParseDiagnosticCode;
    message: string;
    file?: string;
    sourcePos?: SourcePos;
}

/**
 * Parse result with diagnostics
 */
export interface ParseResult {
    /** Parsed spec (may be partial if errors) */
    result?: ParsedSpec;

    /** Diagnostics from parsing */
    diagnostics: ParseDiagnostic[];

    /** Quick check for errors */
    hasErrors: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a source position from unit context
 */
export function createSourcePos(
    unit: SourceUnit,
    line: number,
    column: number
): SourcePos {
    return {
        file: unit.file,
        line: unit.startLine + line - 1,
        column,
    };
}
