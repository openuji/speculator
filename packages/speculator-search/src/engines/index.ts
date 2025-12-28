/**
 * Index Engine Abstraction
 * 
 * Defines the interface for search index engines.
 * Engines transform raw search entries into their specific format.
 */

import type { SearchEntry, DocumentSearchData } from '../types.js';

/**
 * Result from an index engine
 */
export interface IndexEngineResult<T = unknown> {
    /** Engine identifier */
    engine: string;
    /** Engine-specific index data */
    data: T;
}

/**
 * Context passed to index engines during indexing
 */
export interface IndexEngineContext {
    /** Document metadata */
    documentId: string;
    title: string;
    shortName?: string;
}

/**
 * Index Engine Interface
 * 
 * Implement this to create custom search index formats.
 */
export interface IndexEngine<T = unknown> {
    /** Unique engine identifier */
    readonly name: string;

    /**
     * Initialize the engine (called once before indexing)
     */
    init?(): void | Promise<void>;

    /**
     * Add entries from a document to the index
     */
    addDocument(
        entries: SearchEntry[],
        context: IndexEngineContext
    ): void | Promise<void>;

    /**
     * Finalize and return the index data
     */
    finalize(): IndexEngineResult<T> | Promise<IndexEngineResult<T>>;
}

/**
 * Raw Index Engine
 * 
 * Outputs search entries as-is in a plain JSON structure.
 * This is the default engine for client-side search.
 */
export interface RawIndexData {
    version: string;
    documents: DocumentSearchData[];
}

export interface RawEngineOptions {
    /** Include source positions in output */
    includeSourcePos?: boolean;
}

export function createRawEngine(options: RawEngineOptions = {}): IndexEngine<RawIndexData> {
    const documents: DocumentSearchData[] = [];
    const { includeSourcePos = false } = options;

    return {
        name: 'raw',

        addDocument(entries: SearchEntry[], context: IndexEngineContext): void {
            const processedEntries = includeSourcePos
                ? entries
                : entries.map(({ sourcePos: _sourcePos, ...rest }) => rest);

            documents.push({
                documentId: context.documentId,
                title: context.title,
                shortName: context.shortName,
                entries: processedEntries as SearchEntry[]
            });
        },

        finalize(): IndexEngineResult<RawIndexData> {
            return {
                engine: 'raw',
                data: {
                    version: '1.0.0',
                    documents
                }
            };
        }
    };
}
