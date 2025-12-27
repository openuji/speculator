/**
 * Search Index Types for Speculator
 * 
 * These types define the search index structure that maps searchable content
 * to rendered locations for navigation and highlighting.
 */

import type { SourcePos } from '@openuji/speculator';

/**
 * Complete search index for one or more documents
 */
export interface SearchIndex {
    /** Schema version for compatibility */
    version: string;
    /** Documents in the search index */
    documents: DocumentSearchData[];
}

/**
 * Search data for a single document
 */
export interface DocumentSearchData {
    /** Unique document identifier (usually file path) */
    documentId: string;
    /** Route for this document in the rendered site */
    route: string;
    /** Document title */
    title: string;
    /** Short name (if available) */
    shortName?: string;

    /** Filter metadata (pluggable) */
    filters?: {
        documentType?: string;
        tags?: string[];
        [key: string]: any;
    };

    /** Searchable content entries */
    entries: SearchEntry[];
}

/**
 * A searchable content entry with navigation information
 */
export interface SearchEntry {
    /** Unique search identifier (in-memory only, NOT in AST) */
    searchId: string;

    /** Searchable text with formatting */
    text: string;
    /** Plain text for search (stripped of formatting) */
    plainText: string;

    /** Context information */
    context: SearchContext;

    /** Navigation using existing canonical AST IDs */
    blockId?: string;
    sectionId?: string;
    /** Full anchor for navigation (e.g., "#intro") */
    anchor: string;

    /** Filter support (pluggable) */
    filters?: {
        nodeType: string;
        sectionTitle?: string;
        [key: string]: any;
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
    /** Inline type if applicable (emphasis, strong, etc.) */
    inlineType?: string;
}

/**
 * Options for building search index
 */
export interface BuildSearchIndexOptions {
    /** Mode: 'raw' for client-side search, 'flexsearch' for server-side */
    mode?: 'raw' | 'flexsearch';
    /** Include source positions (increases file size) */
    includeSourcePos?: boolean;
    /** Custom filter fields to extract */
    filterFields?: string[];
}

/**
 * Configuration for search index plugin
 */
export interface SearchIndexPluginConfig {
    /** Path to search configuration file */
    configPath?: string;
    /** Routing configuration */
    routing?: {
        /** Strategy for generating routes */
        strategy?: 'pattern' | 'custom';
        /** Pattern for routes (e.g., "/docs/{shortName}") */
        pattern?: string;
        /** Fallback route */
        fallback?: string;
        /** Custom route resolver function */
        getRoute?: (doc: any) => string;
    };
    /** Filter configuration */
    filters?: {
        /** Enable filters */
        enabled?: boolean;
        /** Fields to use for filtering */
        fields?: string[];
    };
}

/**
 * Internal content ID mapping (not exported to JSON)
 */
export interface ContentIdMapping {
    /** Hierarchical search ID */
    searchId: string;
    /** Reference to AST node */
    node: any;
    /** Canonical ID from AST (if exists) */
    canonicalBlockId?: string;
    /** Nearest section's canonical ID */
    canonicalSectionId?: string;
    /** Hierarchical path components */
    path: string[];
}

/**
 * Search configuration file schema
 */
export interface SearchConfig {
    routing?: {
        strategy?: 'pattern' | 'custom' | 'map';
        pattern?: string;
        map?: Record<string, string>;
        fallback?: string;
    };
    search?: {
        mode?: 'raw' | 'flexsearch' | 'both';
        outputPath?: string;
        filters?: {
            enabled?: boolean;
            fields?: string[];
        };
    };
}
