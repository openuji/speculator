/**
 * Parse Stage Types
 * 
 * Types for parsing source units into AST nodes.
 */

import type { SourceFormat, SpecConfig } from '#src/preprocess/types';
import type { Section, Block, Document } from '#src/types/ast.generated';
import type { SourceMapper } from '#src/parse/source-mapper';


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
     * Parse a final composed string into AST blocks using a source mapper
     * for location tracking.
     * 
     * Overload 1: New API with content string and SourceMapper
     * Overload 2: Legacy API with SourceUnit-like object (backwards compat for tests)
     * 
     * @param content - Full composed source string
     * @param sourceMapper - Mapper to resolve absolute offsets to original files
     * @returns Array of top-level blocks/sections
     */
    parse(content: string, sourceMapper: SourceMapper): (Section | Block)[];
    parse(unit: { content: string; file: string; format: string; startLine: number; sideFiles?: Record<string, string> }): (Section | Block)[];
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
// Parse Result
// ============================================================================

/**
 * Parse result
 */
export interface ParseResult {
    /** Parsed spec (may be partial if errors) */
    result?: ParsedSpec;
    /** Encountered errors */
    errors?: string[];
}

// Keep file valid but removed helpers not needed for offset-based mapping
