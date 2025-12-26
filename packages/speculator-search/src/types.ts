/**
 * Speculator Search - Core Types
 * 
 * Type definitions for search functionality with optional anchor mapping.
 */

import type { Workspace, Document, SourcePos } from '@openuji/speculator';

// ============================================================================
// Location Types
// ============================================================================

/**
 * Source location in AST (what speculator knows)
 */
export interface SourceLocation {
    /** Source file path */
    file: string;
    /** 1-indexed line number */
    line: number;
    /** 1-indexed column number */
    column: number;
    /** Optional byte offset */
    offset?: number;
}

/**
 * Rendered location in output (what users navigate to)
 * This is determined by the custom renderer, not speculator
 */
export interface RenderedLocation {
    /** URL path/route (e.g., "/intro" or "/spec.html") */
    route: string;
    /** Fragment identifier (e.g., "#user-agent") */
    anchor: string;
    /** Optional base URL */
    baseUrl?: string;
}

/**
 * Bridge between AST and rendered output.
 * The renderer provides this mapping function.
 * 
 * @param sourcePos - Source location from AST
 * @param nodeId - Optional node ID from AST
 * @returns Rendered location for navigation
 */
export type AnchorMapper = (sourcePos: SourceLocation, nodeId?: string) => RenderedLocation;

// ============================================================================
// Search Index Types
// ============================================================================

/**
 * Term occurrence in the document
 */
export interface TermOccurrence {
    // ===== Source Location (AST) =====
    /** Source location from AST */
    sourcePos: SourceLocation;

    // ===== AST Context =====
    /** Node type (e.g., 'text', 'definition', 'heading') */
    nodeType: string;
    /** AST node ID if available (e.g., 'user-agent', 'section-3') */
    nodeId?: string;

    // ===== Text Context =====
    /** The matched term */
    term: string;
    /** Surrounding text context (e.g., 50 chars before/after) */
    context: string;
    /** Full paragraph/block text */
    fullText?: string;

    // ===== Document Hierarchy =====
    /** Parent section ID */
    sectionId?: string;
    /** Parent section title */
    sectionTitle?: string;
    /** Breadcrumb of heading titles */
    headingPath?: string[];

    // ===== Rendered Location (optional - filled by client) =====
    /** 
     * This field is NEVER set by speculator-search.
     * It's populated by the client using their anchor mapper.
     */
    renderedLocation?: RenderedLocation;
}

/**
 * Document metadata for search
 */
export interface DocumentSearchMeta {
    /** Source file path */
    file: string;
    /** Document title */
    title?: string;
    /** Total unique terms indexed */
    totalTerms: number;
    /** Total unique phrases indexed */
    totalPhrases: number;
}

/**
 * Search index structure
 */
export interface SearchIndex {
    /** Inverted index: term -> occurrences */
    terms: Map<string, TermOccurrence[]>;
    /** Phrase index: phrase -> occurrences */
    phrases: Map<string, TermOccurrence[]>;
    /** Document metadata */
    documents: Map<string, DocumentSearchMeta>;
}

// ============================================================================
// Search API Types
// ============================================================================

/**
 * Search options
 */
export interface SearchOptions {
    // ===== Query =====
    /** Search query string */
    query: string;
    /** Case-sensitive search (default: false) */
    caseSensitive?: boolean;
    /** Match whole words only (default: false) */
    wholeWord?: boolean;
    /** Treat query as regex (default: false) */
    regex?: boolean;

    // ===== Filters =====
    /** Restrict to specific files */
    files?: string[];
    /** Filter by node types (e.g., ['heading', 'definition']) */
    nodeTypes?: string[];
    /** Filter by section IDs */
    sections?: string[];

    // ===== Result Options =====
    /** Maximum number of results (default: unlimited) */
    maxResults?: number;
    /** Context length in characters (default: 100) */
    contextLength?: number;

    // ===== ANCHOR MAPPING (Client-Provided) =====
    /**
     * Optional function to map AST locations to rendered anchors.
     * If provided, search results will include renderedLocation.
     * 
     * The renderer knows its own routing/anchor strategy, so it provides this.
     */
    anchorMapper?: AnchorMapper;
}

/**
 * Search result
 */
export interface SearchResult {
    /** Original query */
    query: string;
    /** Total number of matches */
    totalMatches: number;
    /** Array of matched occurrences */
    matches: TermOccurrence[];
    /** Query execution time in milliseconds */
    queryTime: number;
}

// ============================================================================
// Utility Type Guards
// ============================================================================

/**
 * Convert SourcePos to SourceLocation
 */
export function sourcePosToLocation(sourcePos: SourcePos): SourceLocation {
    return {
        file: sourcePos.file,
        line: sourcePos.line,
        column: sourcePos.column,
        offset: sourcePos.offset,
    };
}

/**
 * Type guard for SearchIndex
 */
export function isSearchIndex(value: unknown): value is SearchIndex {
    return (
        typeof value === 'object' &&
        value !== null &&
        'terms' in value &&
        'phrases' in value &&
        'documents' in value
    );
}
