/**
 * Search Index Types for Speculator
 * 
 * These types define the search index structure that maps searchable content
 * to rendered locations for navigation and highlighting.
 */

import type { SourcePos } from '@openuji/speculator';

/**
 * Search data for a single document
 * 
 * Note: This does NOT include routing information.
 * Routing is the responsibility of the consuming application.
 */
export interface DocumentSearchData {
    /** Unique document identifier (usually absolute file path) */
    documentId: string;
    /** Document title */
    title: string;
    /** Short name (if available in document metadata) */
    shortName?: string;

    /** Filter metadata (pluggable) */
    filters?: {
        documentType?: string;
        tags?: string[];
        [key: string]: unknown;
    };

    /** Searchable content entries */
    entries: SearchEntry[];
}

/**
 * A searchable content entry with navigation information
 */
export interface SearchEntry {
    /** Unique search identifier for this entry */
    searchId: string;

    /** Searchable text with formatting */
    text: string;
    /** Plain text for search (stripped of formatting, normalized) */
    plainText: string;

    /** Context information for display */
    context: SearchContext;

    /** Block ID for anchor navigation (if available) */
    blockId?: string;
    /** Section ID containing this entry */
    sectionId?: string;
    /** Full anchor for navigation (e.g., "#intro") */
    anchor: string;

    /** Filter support (pluggable) */
    filters?: {
        nodeType: string;
        sectionTitle?: string;
        [key: string]: unknown;
    };

    /** Source position (optional, for debugging) */
    sourcePos?: SourcePos;
}

/**
 * Context information for search results
 */
export interface SearchContext {
    /** Title of containing section */
    sectionTitle?: string;
    /** Hierarchical path of headings */
    headingPath?: string[];
    /** Node type (paragraph, table, list, etc.) */
    nodeType: string;
    /** Inline type if applicable (definition, reference, etc.) */
    inlineType?: string;
}

