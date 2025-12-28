/**
 * Speculator Search - Main Entry Point
 * 
 * Pure post-processor for building search indexes from Speculator Workspace AST.
 * 
 * @example
 * ```typescript
 * import { SpeculatorPipeline, corePlugins } from '@openuji/speculator';
 * import { buildSearchIndex } from '@openuji/speculator-search';
 * 
 * const pipeline = new SpeculatorPipeline(corePlugins);
 * const result = await pipeline.runWorkspace({ entries, fileProvider });
 * 
 * const { data } = await buildSearchIndex(result.workspace);
 * // data.documents contains search entries with documentId, title, entries
 * // Client handles routing: documentId → route
 * ```
 */

// Main API - standalone builder
export { buildSearchIndex, type BuildSearchIndexOptions } from './standalone.js';

// Index Engines
export {
    type IndexEngine,
    type IndexEngineResult,
    type IndexEngineContext,
    createRawEngine,
    type RawIndexData,
    type RawEngineOptions
} from './engines/index.js';

// Types
export type {
    DocumentSearchData,
    SearchEntry,
    SearchContext
} from './types.js';

// Utilities
export {
    extractTextFromInlines,
    extractTextFromInline,
    normalizeTextForSearch
} from './utils/extract-text.js';

