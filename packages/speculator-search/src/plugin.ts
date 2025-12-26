/**
 * Speculator Search - Plugin Integration
 * 
 * Speculator plugin that builds search indexes during the compute phase.
 */

import type { Plugin, Document } from '@openuji/speculator';
import { buildSearchIndex } from './indexer.js';

/**
 * Search index plugin
 * 
 * Builds a search index from the document and attaches it to document.computed.searchIndex
 * 
 * Usage:
 * ```typescript
 * import { speculate, corePlugins } from '@openuji/speculator';
 * import { searchIndexPlugin } from '@openuji/speculator-search';
 * 
 * const result = await speculate({
 *   entry: 'spec.md',
 *   plugins: [...corePlugins, searchIndexPlugin],
 * });
 * ```
 */
export const searchIndexPlugin: Plugin = {
    name: 'search-index',

    // Run late in compute phase to ensure all other postprocessing is done
    order: {
        compute: 200,
    },

    async compute(ctx: { document: Document; level: number; workspace?: any }) {
        // Build search index from document AST
        const index = buildSearchIndex(ctx.document);

        // Attach to document.computed
        if (!ctx.document.computed) {
            ctx.document.computed = {};
        }

        // Store the index
        (ctx.document.computed as any).searchIndex = index;
    },
};
