/**
 * Content ID Plugin
 * 
 * Generates hierarchical search IDs for all blocks and inline nodes WITHOUT modifying AST.
 * Maintains an in-memory mapping from searchId to AST node reference and canonical IDs.
 * 
 * CRITICAL: This plugin does NOT add or modify the `id` field on AST nodes.
 */

import type { Plugin, Document, Section, Block, Inline } from '@openuji/speculator';
import type { ContentIdMapping } from '../types.js';

// IndexContext isn't exported, so we'll work with type inference
type PluginContext = { document: Document; level: number; workspace?: any };

/**
 * Symbol to attach mapping data to plugin context
 */
export const CONTENT_ID_MAP_SYMBOL = Symbol('contentIdMap');

/**
 * Get or create content ID map from document
 */
function getContentIdMap(document: Document): Map<string, ContentIdMapping> {
    if (!(document as any)[CONTENT_ID_MAP_SYMBOL]) {
        (document as any)[CONTENT_ID_MAP_SYMBOL] = new Map<string, ContentIdMapping>();
    }
    return (document as any)[CONTENT_ID_MAP_SYMBOL];
}

/**
 * Generate hierarchical search ID path
 */
function generateSearchId(path: string[]): string {
    return path.join('.');
}

/**
 * Walk document and generate search IDs for all nodes
 */
function generateSearchIds(
    document: Document,
    contentIdMap: Map<string, ContentIdMapping>
): void {
    let currentSectionId: string | undefined;

    /**
     * Process a section and its children
     */
    function processSection(section: Section, parentPath: string[]): void {
        const sectionId = section.id || `section-${parentPath.length}`;
        const sectionPath = [...parentPath, sectionId];

        // Track current section ID for blocks
        const previousSectionId = currentSectionId;
        currentSectionId = section.id;

        // Process section children
        let blockIndex = 0;
        let subSectionIndex = 0;

        for (const child of section.children) {
            if ((child as any).type === 'section') {
                processSection(child as Section, [...sectionPath, `s-${subSectionIndex}`]);
                subSectionIndex++;
            } else {
                processBlock(child as Block, sectionPath, blockIndex);
                blockIndex++;
            }
        }

        currentSectionId = previousSectionId;
    }

    /**
     * Process a block and its children
     */
    function processBlock(block: Block, parentPath: string[], blockIndex: number): void {
        const blockType = block.type;
        const blockPath = [...parentPath, `${getBlockPrefix(blockType)}-${blockIndex}`];
        const searchId = generateSearchId(blockPath);

        // Store mapping (searchId → node + canonical IDs)
        contentIdMap.set(searchId, {
            searchId,
            node: block,
            canonicalBlockId: block.id,
            canonicalSectionId: currentSectionId,
            path: blockPath
        });

        // Process block children based on type
        if ('children' in block && Array.isArray(block.children)) {
            if (blockType === 'paragraph' || blockType === 'heading') {
                // Inline children
                processInlines(block.children as Inline[], blockPath);
            } else if (blockType === 'list') {
                // List items
                let itemIndex = 0;
                for (const item of block.children) {
                    if (item.type === 'listItem') {
                        processListItem(item, blockPath, itemIndex);
                        itemIndex++;
                    }
                }
            } else if (blockType === 'table') {
                // Table rows
                let rowIndex = 0;
                for (const row of block.children) {
                    if (row.type === 'tableRow') {
                        processTableRow(row, blockPath, rowIndex);
                        rowIndex++;
                    }
                }
            } else {
                // Other blocks with block children (blockquote, example, note)
                let childIndex = 0;
                for (const child of block.children) {
                    processBlock(child as Block, blockPath, childIndex);
                    childIndex++;
                }
            }
        }
    }

    /**
     * Process list item
     */
    function processListItem(item: any, parentPath: string[], itemIndex: number): void {
        const itemPath = [...parentPath, `li-${itemIndex}`];
        const searchId = generateSearchId(itemPath);

        contentIdMap.set(searchId, {
            searchId,
            node: item,
            canonicalSectionId: currentSectionId,
            path: itemPath
        });

        // Process list item children (blocks)
        let blockIndex = 0;
        for (const child of item.children) {
            processBlock(child as Block, itemPath, blockIndex);
            blockIndex++;
        }
    }

    /**
     * Process table row
     */
    function processTableRow(row: any, parentPath: string[], rowIndex: number): void {
        const rowPath = [...parentPath, `row-${rowIndex}`];

        let cellIndex = 0;
        for (const cell of row.children) {
            if (cell.type === 'tableCell') {
                const cellPath = [...rowPath, `cell-${cellIndex}`];
                const searchId = generateSearchId(cellPath);

                contentIdMap.set(searchId, {
                    searchId,
                    node: cell,
                    canonicalSectionId: currentSectionId,
                    path: cellPath
                });

                // Process cell inlines
                processInlines(cell.children as Inline[], cellPath);
                cellIndex++;
            }
        }
    }

    /**
     * Process inline nodes
     */
    function processInlines(inlines: Inline[], parentPath: string[]): void {
        let textIndex = 0;
        let emphasisIndex = 0;
        let strongIndex = 0;
        let codeIndex = 0;
        let linkIndex = 0;
        let definitionIndex = 0;
        let referenceIndex = 0;
        let citeIndex = 0;

        for (const inline of inlines) {
            let inlinePath: string[];

            switch (inline.type) {
                case 'text':
                    inlinePath = [...parentPath, `text-${textIndex}`];
                    textIndex++;
                    break;
                case 'emphasis':
                    inlinePath = [...parentPath, `em-${emphasisIndex}`];
                    emphasisIndex++;
                    break;
                case 'strong':
                    inlinePath = [...parentPath, `strong-${strongIndex}`];
                    strongIndex++;
                    break;
                case 'inlineCode':
                    inlinePath = [...parentPath, `code-${codeIndex}`];
                    codeIndex++;
                    break;
                case 'link':
                    inlinePath = [...parentPath, `link-${linkIndex}`];
                    linkIndex++;
                    break;
                case 'definition':
                    inlinePath = [...parentPath, `dfn-${definitionIndex}`];
                    definitionIndex++;
                    break;
                case 'reference':
                    inlinePath = [...parentPath, `ref-${referenceIndex}`];
                    referenceIndex++;
                    break;
                case 'cite':
                    inlinePath = [...parentPath, `cite-${citeIndex}`];
                    citeIndex++;
                    break;
                default:
                    continue;
            }

            const searchId = generateSearchId(inlinePath);

            contentIdMap.set(searchId, {
                searchId,
                node: inline,
                canonicalSectionId: currentSectionId,
                path: inlinePath
            });

            // Process children if present
            if ('children' in inline && Array.isArray(inline.children)) {
                processInlines(inline.children as Inline[], inlinePath);
            }
        }
    }

    /**
     * Get block type prefix for search ID
     */
    function getBlockPrefix(type: string): string {
        const prefixMap: Record<string, string> = {
            'paragraph': 'p',
            'heading': 'h',
            'codeBlock': 'code',
            'example': 'ex',
            'blockquote': 'bq',
            'list': 'list',
            'table': 'table',
            'thematicBreak': 'hr',
            'html': 'html',
            'note': 'note'
        };
        return prefixMap[type] || type;
    }

    // Process document children
    let childIndex = 0;
    for (const child of document.children) {
        if ((child as any).type === 'section') {
            processSection(child as Section, []);
        } else {
            processBlock(child as Block, [], childIndex);
            childIndex++;
        }
    }
}

/**
 * Content ID Plugin
 * 
 * Generates hierarchical search IDs WITHOUT modifying AST
 */
export const contentIdPlugin: Plugin = {
    name: 'content-id',
    order: { index: 5 },

    async index(ctx: PluginContext): Promise<void> {
        const contentIdMap = getContentIdMap(ctx.document);
        generateSearchIds(ctx.document, contentIdMap);
    }
};

/**
 * Export function to access content ID map from document
 */
export function getContentIdMapFromContext(ctx: PluginContext): Map<string, ContentIdMapping> | null {
    return (ctx.document as any)[CONTENT_ID_MAP_SYMBOL] || null;
}

/**
 * Export function to access content ID map from document directly
 */
export function getContentIdMapFromDocument(document: Document): Map<string, ContentIdMapping> | null {
    return (document as any)[CONTENT_ID_MAP_SYMBOL] || null;
}
