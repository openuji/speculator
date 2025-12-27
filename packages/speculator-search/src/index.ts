/**
 * Speculator Search - Main Entry Point
 * 
 * Search index builder for Speculator with content mapping and navigation support.
 */

// Plugins
export { contentIdPlugin, getContentIdMapFromContext, getContentIdMapFromDocument } from './plugins/content-id.js';
export { searchIndexPlugin, getSearchEntriesFromContext } from './plugins/search-index.js';

// Builders
export { buildSearchIndex, loadSearchConfig, applyRoutingConfig } from './builders/search-index-builder.js';

// Types
export type {
    SearchIndex,
    DocumentSearchData,
    SearchEntry,
    SearchContext,
    BuildSearchIndexOptions,
    SearchIndexPluginConfig,
    ContentIdMapping,
    SearchConfig
} from './types.js';

// Utilities
export { extractTextFromInlines, extractTextFromInline, normalizeTextForSearch } from './utils/extract-text.js';
