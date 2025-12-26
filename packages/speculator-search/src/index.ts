/**
 * Speculator Search - Public API
 * 
 * Search functionality for Speculator workspace AST with optional anchor mapping.
 */

// Main exports
export { searchIndexPlugin } from './plugin.js';
export { search } from './searcher.js';
export { buildSearchIndex } from './indexer.js';

// Type exports
export type {
    SourceLocation,
    RenderedLocation,
    AnchorMapper,
    TermOccurrence,
    DocumentSearchMeta,
    SearchIndex,
    SearchOptions,
    SearchResult,
} from './types.js';

// Utility exports (advanced usage)
export {
    tokenize,
    normalizeText,
    extractPhrases,
    extractContext,
} from './tokenizer.js';
