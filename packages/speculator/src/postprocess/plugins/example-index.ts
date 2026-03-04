/**
 * Example Index Plugin
 * 
 * Indexes all examples (BlockExample) in the document.
 * Handles automatic numbering ("EXAMPLE 1") and stable hash-based ID generation.
 * 
 * IDs are generated from a content hash (like Bikeshed's approach), so they
 * remain stable even when examples are reordered. Only content changes
 * will produce a new ID.
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';
import type { Document, BlockExample, Block, Inline } from '#src/types/ast.generated';
import { walkDocument } from '#src/postprocess/walk-ast';

/**
 * Extract text content from blocks recursively for hashing
 */
function extractBlockText(blocks: Block[]): string {
    const parts: string[] = [];
    for (const block of blocks) {
        switch (block.type) {
            case 'paragraph':
                parts.push(extractInlineText(block.children as Inline[]));
                break;
            case 'codeBlock':
                parts.push(block.value || '');
                break;
            case 'list':
                if (block.children) {
                    for (const item of block.children) {
                        if ('children' in item && Array.isArray(item.children)) {
                            parts.push(extractBlockText(item.children as Block[]));
                        }
                    }
                }
                break;
            default:
                if ('value' in block && typeof block.value === 'string') {
                    parts.push(block.value);
                }
                if ('children' in block && Array.isArray(block.children)) {
                    parts.push(extractBlockText(block.children as Block[]));
                }
                break;
        }
    }
    return parts.join('\n');
}

/**
 * Extract text from inline nodes
 */
function extractInlineText(inlines: Inline[]): string {
    return inlines.map(inline => {
        if ('value' in inline && typeof inline.value === 'string') return inline.value;
        if ('children' in inline && Array.isArray(inline.children)) {
            return extractInlineText(inline.children as Inline[]);
        }
        return '';
    }).join('');
}

/**
 * Simple hash function (djb2) that produces a hex string.
 * Matches Bikeshed's approach of content-based hashes for stable anchors.
 */
function hashContent(text: string): string {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }
    // Convert to unsigned 32-bit hex
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Build example index from document into document.indexes.examples
 */
function buildExampleIndex(document: Document): void {
    // Initialize indexes structure
    if (!document.indexes) {
        document.indexes = {};
    }
    if (!document.indexes.examples) {
        document.indexes.examples = [];
    }
    const exampleIndex = document.indexes.examples;
    const usedIds = new Set<string>();

    let exampleCount = 0;

    walkDocument(document, {
        visitExample: (example: BlockExample) => {
            exampleCount++;

            // 1. Assign/Verify ID
            if (!example.id) {
                // Generate a content-based hash ID (Bikeshed-style)
                const contentText = extractBlockText(example.children as Block[]);
                const contentHash = hashContent(contentText);
                let candidateId = `example-${contentHash}`;

                // Ensure uniqueness (unlikely collision but just in case)
                let suffix = 2;
                while (usedIds.has(candidateId)) {
                    candidateId = `example-${contentHash}-${suffix}`;
                    suffix++;
                }
                example.id = candidateId;
            }
            usedIds.add(example.id);

            // 2. Assign Title/Label
            // If no explicit title, set to "EXAMPLE N"
            if (!example.title) {
                example.title = `EXAMPLE ${exampleCount}`;
            }

            // 3. Create index entry
            exampleIndex.push({
                id: example.id,
                title: example.title,
                sourcePos: example.sourcePos || {
                    file: document.sourcePos?.file || 'unknown',
                    line: 0,
                    column: 0
                }
            });
        }
    });
}

/**
 * Example index plugin
 */
export const exampleIndexPlugin: Plugin = {
    name: 'example-index',
    order: { index: 15 }, // Run after section-id and dfn-index

    async index(ctx: IndexContext): Promise<void> {
        buildExampleIndex(ctx.document);
    },
};
