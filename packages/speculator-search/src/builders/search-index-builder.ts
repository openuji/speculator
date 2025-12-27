/**
 * Search Index Builder
 * 
 * Builds final search index from Speculator result.
 * The plugins attach search data to the runtime workspace which we extract here.
 */

import type {
    SearchIndex,
    DocumentSearchData,
    BuildSearchIndexOptions,
    SearchConfig,
    SearchEntry
} from '../types.js';
import { SEARCH_ENTRIES_SYMBOL } from '../plugins/search-index.js';
import fs from 'fs/promises';

/**
 * Build search index from plugin execution results
 * 
 * This function expects that the speculate pipeline has been run with
 * contentIdPlugin and searchIndexPlugin.
 */
export function buildSearchIndex(
    result: any,  // SpeculateResult from speculate() call
    options: BuildSearchIndexOptions = {}
): SearchIndex {
    const {
        mode = 'raw',
        includeSourcePos = false
    } = options;

    const searchIndex: SearchIndex = {
        version: '1.0.0',
        documents: []
    };

    // Access the workspace from result
    const workspace = result.workspace || result;

    if (!workspace || !workspace.documents) {
        console.warn('[buildSearchIndex] No documents found in workspace');
        return searchIndex;
    }

    // Process each document
    for (const doc of workspace.documents) {
        const documentData = buildDocumentSearchData(doc, {
            includeSourcePos
        });

        if (documentData && documentData.entries.length > 0) {
            searchIndex.documents.push(documentData);
        }
    }

    return searchIndex;
}

/**
 * Build search data for a single document
 */
function buildDocumentSearchData(
    doc: any,
    options: { includeSourcePos?: boolean }
): DocumentSearchData | null {
    // Get document metadata
    const metadata = doc.metadata || {};
    const documentId = doc.sourcePos?.file || 'unknown';
    const title = metadata.title || '';
    const shortName = metadata.shortName;

    // Default route (can be overridden by configuration)
    const route = shortName ? `/${shortName}` : '/';

    // Extract search entries from document's runtime context
    // The plugin attaches entries to the document during index phase
    const searchEntries: SearchEntry[] = (doc as any)[SEARCH_ENTRIES_SYMBOL] || [];

    const documentData: DocumentSearchData = {
        documentId,
        route,
        title,
        shortName,
        entries: options.includeSourcePos
            ? searchEntries
            : searchEntries.map(entry => {
                const { sourcePos, ...rest } = entry;
                return rest;
            })
    };

    // Add document-level filters
    if (metadata.status) {
        documentData.filters = {
            documentType: metadata.status
        };
    }

    return documentData;
}

/**
 * Load search configuration from file
 */
export async function loadSearchConfig(configPath: string): Promise<SearchConfig> {
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`[search-index] Could not load config from ${configPath}:`, error);
        return {};
    }
}

/**
 * Apply routing configuration to search index
 */
/**
 * Apply routing configuration to search index
 */
export function applyRoutingConfig(
    searchIndex: SearchIndex,
    config: SearchConfig,
    rootDir?: string
): void {
    const routing = config.routing;
    if (!routing) return;

    for (const doc of searchIndex.documents) {
        let applied = false;

        if (routing.strategy === 'map' && routing.map && rootDir) {
            // Apply map-based routing
            const docPath = doc.documentId.split(/[/\\]/).join('/');
            const rootPath = rootDir.split(/[/\\]/).join('/');

            let relativePath = docPath;
            if (docPath.startsWith(rootPath)) {
                relativePath = docPath.substring(rootPath.length);
                if (relativePath.startsWith('/')) {
                    relativePath = relativePath.substring(1);
                }
            }

            if (routing.map[relativePath]) {
                doc.route = routing.map[relativePath];
                applied = true;
            }
        } else if (routing.strategy === 'pattern' && routing.pattern) {
            // Apply pattern-based routing
            doc.route = applyRoutePattern(routing.pattern, doc);
            applied = true;
        }

        if (!applied && routing.fallback && (!doc.route || doc.route === '/')) {
            doc.route = routing.fallback;
        }
    }
}

/**
 * Apply route pattern with variable substitution
 */
function applyRoutePattern(pattern: string, doc: DocumentSearchData): string {
    return pattern
        .replace('{shortName}', doc.shortName || '')
        .replace('{documentId}', doc.documentId)
        .replace('{title}', encodeURIComponent(doc.title));
}
