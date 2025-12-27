/**
 * Search Index Plugin
 * 
 * Collects searchable content from documents during the index phase.
 * Works in conjunction with content-id plugin to build search index.
 */

import type { Plugin, Document, Section, Block, Inline } from '@openuji/speculator';
import type { SearchEntry, SearchIndexPluginConfig, SearchContext } from '../types.js';
import { getContentIdMapFromContext } from './content-id.js';
import { extractTextFromInlines, normalizeTextForSearch } from '../utils/extract-text.js';

// IndexContext isn't exported, so we'll work with type inference
type PluginContext = { document: Document; level: number; workspace?: any };

/**
 * Symbol to attach search entries to plugin context
 */
export const SEARCH_ENTRIES_SYMBOL = Symbol('searchEntries');

/**
 * Get or create search entries array from context
 */
function getSearchEntries(ctx: PluginContext): SearchEntry[] {
    if (!(ctx as any)[SEARCH_ENTRIES_SYMBOL]) {
        (ctx as any)[SEARCH_ENTRIES_SYMBOL] = [];
    }
    return (ctx as any)[SEARCH_ENTRIES_SYMBOL];
}

/**
 * Build search index from document
 */
function buildSearchEntries(
    document: Document,
    ctx: PluginContext
): void {
    const searchEntries = getSearchEntries(ctx);
    const contentIdMap = getContentIdMapFromContext(ctx);

    if (!contentIdMap) {
        console.warn('[search-index] content-id plugin not found. Make sure it runs before search-index plugin.');
        return;
    }

    let currentSection: { id?: string; title?: string; headingPath: string[] } = {
        headingPath: []
    };

    /**
     * Process section and track context
     */
    function processSection(section: Section): void {
        const previousSection = currentSection;

        // Extract section title from heading
        const sectionTitle = section.heading
            ? extractTextFromInlines(section.heading.children)
            : undefined;

        currentSection = {
            id: section.id,
            title: sectionTitle,
            headingPath: sectionTitle
                ? [...previousSection.headingPath, sectionTitle]
                : previousSection.headingPath
        };

        // Process section children
        for (const child of section.children) {
            if ((child as any).type === 'section') {
                processSection(child as Section);
            } else {
                processBlock(child as Block);
            }
        }

        currentSection = previousSection;
    }

    /**
     * Process block and extract searchable content
     */
    function processBlock(block: Block): void {
        const blockType = block.type;

        // Process based on block type
        if (blockType === 'paragraph' || blockType === 'heading') {
            const inlines = block.children as Inline[];
            processInlines(inlines, blockType, block.id);
        } else if (blockType === 'codeBlock') {
            // Index code blocks by their content
            addSearchEntry({
                text: block.value,
                node: block,
                nodeType: 'codeBlock',
                blockId: block.id
            });
        } else if (blockType === 'list') {
            // Process list items
            for (const item of block.children) {
                if (item.type === 'listItem') {
                    for (const child of item.children) {
                        processBlock(child as Block);
                    }
                }
            }
        } else if (blockType === 'table') {
            // Process table cells
            for (const row of block.children) {
                if (row.type === 'tableRow') {
                    for (const cell of row.children) {
                        if (cell.type === 'tableCell') {
                            processInlines(cell.children as Inline[], 'tableCell');
                        }
                    }
                }
            }
        } else if ('children' in block && Array.isArray(block.children)) {
            // Process nested blocks (blockquote, example, note)
            for (const child of block.children) {
                processBlock(child as Block);
            }
        }
    }

    /**
     * Process inline nodes and extract text
     */
    /**
     * Process inline nodes and extract text
     */
    function processInlines(
        inlines: Inline[],
        parentType: string,
        blockId?: string
    ): void {
        // Extract full text from all inlines for this block - ONE entry per block
        const fullText = extractTextFromInlines(inlines);

        if (fullText.trim()) {
            addSearchEntry({
                text: fullText,
                node: inlines[0], // Representative node
                nodeType: parentType,
                blockId
            });
        }

        // Recursively find special types (definitions, references)
        findSpecialInlines(inlines, blockId);
    }

    /**
     * Recursively find special inlines (definitions, references)
     */
    function findSpecialInlines(inlines: Inline[], blockId?: string): void {
        for (const inline of inlines) {
            if (inline.type === 'definition') {
                addSearchEntry({
                    text: inline.term,
                    node: inline,
                    nodeType: 'definition',
                    inlineType: 'definition',
                    blockId
                });
            } else if (inline.type === 'reference') {
                addSearchEntry({
                    text: inline.targetTerm,
                    node: inline,
                    nodeType: 'reference',
                    inlineType: 'reference',
                    blockId
                });
            }

            // Recurse into children
            if ('children' in inline && Array.isArray(inline.children)) {
                findSpecialInlines(inline.children as Inline[], blockId);
            }
        }
    }

    /**
     * Add search entry
     */
    function addSearchEntry(params: {
        text: string;
        node: any;
        nodeType: string;
        inlineType?: string;
        blockId?: string;
    }): void {
        const { text, node, nodeType, inlineType, blockId } = params;

        // Find searchId from content ID map
        let searchId: string | undefined;
        let mapping;

        if (contentIdMap) {
            for (const [id, map] of contentIdMap.entries()) {
                if (map.node === node) {
                    searchId = id;
                    mapping = map;
                    break;
                }
            }
        }

        if (!searchId) {
            // Fallback: generate simple ID
            searchId = `unknown-${searchEntries.length}`;
        }

        // Determine anchor (use canonical IDs)
        const anchor = blockId
            ? `#${blockId}`
            : mapping?.canonicalSectionId
                ? `#${mapping.canonicalSectionId}`
                : '';

        const entry: SearchEntry = {
            searchId,
            text: text.trim(),
            plainText: normalizeTextForSearch(text),
            context: {
                sectionTitle: currentSection.title,
                headingPath: currentSection.headingPath.length > 0
                    ? [...currentSection.headingPath]
                    : undefined,
                nodeType,
                inlineType
            },
            blockId,
            sectionId: mapping?.canonicalSectionId || currentSection.id,
            anchor,
            filters: {
                nodeType,
                sectionTitle: currentSection.title
            }
        };

        // Add source position if available
        if (node.sourcePos) {
            entry.sourcePos = node.sourcePos;
        }

        searchEntries.push(entry);
    }

    // Process document children
    for (const child of document.children) {
        if ((child as any).type === 'section') {
            processSection(child as Section);
        } else {
            processBlock(child as Block);
        }
    }

    // Attach search entries to document for builder access
    (document as any)[SEARCH_ENTRIES_SYMBOL] = searchEntries;
}

/**
 * Search Index Plugin
 */
export function searchIndexPlugin(config: SearchIndexPluginConfig = {}): Plugin {
    return {
        name: 'search-index',
        order: { index: 10 }, // Run after content-id (which has order 5)

        async index(ctx: PluginContext): Promise<void> {
            buildSearchEntries(ctx.document, ctx);
        }
    };
}

/**
 * Export function to access search entries from plugin context
 */
export function getSearchEntriesFromContext(ctx: PluginContext): SearchEntry[] | null {
    return (ctx as any)[SEARCH_ENTRIES_SYMBOL] || null;
}
