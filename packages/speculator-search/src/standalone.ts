/**
 * Standalone Search Index Builder
 * 
 * Pure function that transforms a Workspace AST into a search index.
 * No plugins required - works directly on the finalized Workspace.
 */

import type { Workspace, Document, Section, Block, Inline, SourcePos } from '@openuji/speculator';
import type { SearchEntry, SearchContext } from './types.js';
import type { IndexEngine, IndexEngineContext } from './engines/index.js';
import { createRawEngine, type RawIndexData, type RawEngineOptions } from './engines/index.js';
import { extractTextFromInlines, normalizeTextForSearch } from './utils/extract-text.js';

/**
 * Options for building search index
 */
export interface BuildSearchIndexOptions extends RawEngineOptions {
    /**
     * Custom index engine to use.
     * Defaults to raw engine if not specified.
     */
    engine?: IndexEngine;
}

/**
 * Build search index from a Workspace AST
 * 
 * This is the main entry point - a pure function that takes
 * a Workspace and returns a search index.
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
 * // data.documents contains search entries
 * ```
 */
export async function buildSearchIndex<T = RawIndexData>(
    workspace: Workspace,
    options: BuildSearchIndexOptions = {}
): Promise<{ engine: string; data: T }> {
    const engine = options.engine ?? createRawEngine({
        includeSourcePos: options.includeSourcePos
    });

    // Initialize engine
    await engine.init?.();

    // Process each document
    for (const doc of workspace.documents) {
        const entries = extractSearchEntries(doc);

        const context: IndexEngineContext = {
            documentId: doc.sourcePos?.file || 'unknown',
            title: doc.metadata?.title || '',
            shortName: doc.metadata?.shortName
        };

        await engine.addDocument(entries, context);
    }

    // Finalize and return
    const result = await engine.finalize();
    return result as { engine: string; data: T };
}

/**
 * Extract search entries from a document
 * 
 * Pure function that walks the AST and extracts searchable content.
 */
function extractSearchEntries(document: Document): SearchEntry[] {
    const entries: SearchEntry[] = [];
    let entryIndex = 0;

    // Track current section context
    let currentSection: { id?: string; title?: string; headingPath: string[] } = {
        headingPath: []
    };

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
            if ('type' in child && child.type === 'section') {
                processSection(child as Section);
            } else {
                processBlock(child as Block);
            }
        }

        currentSection = previousSection;
    }

    function processBlock(block: Block): void {
        const blockType = block.type;

        if (blockType === 'paragraph' || blockType === 'heading') {
            const inlines = block.children as Inline[];
            const text = extractTextFromInlines(inlines);

            if (text.trim()) {
                addEntry({
                    text,
                    nodeType: blockType,
                    blockId: block.id,
                    sourcePos: block.sourcePos
                });
            }

            // Find special inlines (definitions, references)
            findSpecialInlines(inlines, block.id);

        } else if (blockType === 'codeBlock') {
            addEntry({
                text: block.value,
                nodeType: 'codeBlock',
                blockId: block.id,
                sourcePos: block.sourcePos
            });

        } else if (blockType === 'list') {
            for (const item of block.children) {
                if (item.type === 'listItem') {
                    for (const child of item.children) {
                        processBlock(child as Block);
                    }
                }
            }

        } else if (blockType === 'table') {
            for (const row of block.children) {
                if (row.type === 'tableRow') {
                    for (const cell of row.children) {
                        if (cell.type === 'tableCell') {
                            const text = extractTextFromInlines(cell.children as Inline[]);
                            if (text.trim()) {
                                addEntry({
                                    text,
                                    nodeType: 'tableCell',
                                    sourcePos: cell.sourcePos
                                });
                            }
                        }
                    }
                }
            }

        } else if ('children' in block && Array.isArray(block.children)) {
            for (const child of block.children) {
                processBlock(child as Block);
            }
        }
    }

    function findSpecialInlines(inlines: Inline[], blockId?: string): void {
        for (const inline of inlines) {
            if (inline.type === 'definition') {
                addEntry({
                    text: inline.term,
                    nodeType: 'definition',
                    inlineType: 'definition',
                    blockId,
                    sourcePos: inline.sourcePos
                });
            } else if (
                inline.type === 'workspaceDfnReference' ||
                inline.type === 'workspaceIdlReference' ||
                inline.type === 'workspaceElementReference' ||
                inline.type === 'externalDfnReference' ||
                inline.type === 'externalIdlReference' ||
                inline.type === 'externalElementReference'
            ) {
                addEntry({
                    text: inline.targetTerm,
                    nodeType: 'reference',
                    inlineType: inline.type,
                    blockId,
                    sourcePos: inline.sourcePos
                });
            }

            // Recurse
            if ('children' in inline && Array.isArray(inline.children)) {
                findSpecialInlines(inline.children as Inline[], blockId);
            }
        }
    }

    function addEntry(params: {
        text: string;
        nodeType: string;
        inlineType?: string;
        blockId?: string;
        sourcePos?: SourcePos;
    }): void {
        const { text, nodeType, inlineType, blockId, sourcePos } = params;

        // Determine anchor
        const anchor = blockId
            ? `#${blockId}`
            : currentSection.id
                ? `#${currentSection.id}`
                : '';

        const context: SearchContext = {
            sectionTitle: currentSection.title,
            headingPath: currentSection.headingPath.length > 0
                ? [...currentSection.headingPath]
                : undefined,
            nodeType,
            inlineType
        };

        const entry: SearchEntry = {
            searchId: `entry-${entryIndex++}`,
            text: text.trim(),
            plainText: normalizeTextForSearch(text),
            context,
            blockId,
            sectionId: currentSection.id,
            anchor,
            filters: {
                nodeType,
                sectionTitle: currentSection.title
            }
        };

        if (sourcePos) {
            entry.sourcePos = sourcePos;
        }

        entries.push(entry);
    }

    // Process document children
    for (const child of document.children) {
        if ('type' in child && child.type === 'section') {
            processSection(child as Section);
        } else {
            processBlock(child as Block);
        }
    }

    return entries;
}
