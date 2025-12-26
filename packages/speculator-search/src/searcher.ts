/**
 * Speculator Search - Query Execution
 * 
 * Executes search queries against the built index with filtering and anchor mapping.
 */

import type { Workspace, Document } from '@openuji/speculator';
import type {
    SearchOptions,
    SearchResult,
    TermOccurrence,
    SearchIndex,
} from './types.js';
import { normalizeText } from './tokenizer.js';
import { isSearchIndex } from './types.js';

/**
 * Search the workspace for a query
 * 
 * @param workspace - Workspace to search
 * @param options - Search options
 * @returns Search results
 */
export function search(workspace: Workspace, options: SearchOptions): SearchResult {
    const startTime = performance.now();

    // Extract search indexes from documents
    const indexes: SearchIndex[] = [];
    for (const document of workspace.documents) {
        const index = getSearchIndex(document);
        if (index) {
            indexes.push(index);
        }
    }

    if (indexes.length === 0) {
        return {
            query: options.query,
            totalMatches: 0,
            matches: [],
            queryTime: performance.now() - startTime,
        };
    }

    // Normalize query
    let query = options.caseSensitive ? options.query : normalizeText(options.query);

    // Collect all matches
    let matches: TermOccurrence[] = [];

    for (const index of indexes) {
        // Search in terms and phrases
        const termMatches = index.terms.get(query) || [];
        const phraseMatches = index.phrases.get(query) || [];

        matches.push(...termMatches, ...phraseMatches);
    }

    // Apply filters
    if (options.files && options.files.length > 0) {
        matches = matches.filter(m => options.files!.includes(m.sourcePos.file));
    }

    if (options.nodeTypes && options.nodeTypes.length > 0) {
        matches = matches.filter(m => options.nodeTypes!.includes(m.nodeType));
    }

    if (options.sections && options.sections.length > 0) {
        matches = matches.filter(m => m.sectionId && options.sections!.includes(m.sectionId));
    }

    // Apply anchor mapper if provided
    if (options.anchorMapper) {
        matches = matches.map(match => ({
            ...match,
            renderedLocation: options.anchorMapper!(match.sourcePos, match.nodeId),
        }));
    }

    // Limit results
    if (options.maxResults && options.maxResults > 0) {
        matches = matches.slice(0, options.maxResults);
    }

    const queryTime = performance.now() - startTime;

    return {
        query: options.query,
        totalMatches: matches.length,
        matches,
        queryTime,
    };
}

/**
 * Extract search index from document.computed
 */
function getSearchIndex(document: Document): SearchIndex | null {
    const computed = document.computed as any;
    if (!computed || !computed.searchIndex) {
        return null;
    }

    const index = computed.searchIndex;
    return isSearchIndex(index) ? index : null;
}
