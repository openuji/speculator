/**
 * Note Index Plugin
 * 
 * Assigns stable, content-hash-based IDs to note/issue/warning blocks
 * that don't already have explicit IDs.
 * 
 * ID format: `{noteType}-{contentHash}`, e.g. `issue-3821d21b`
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';
import type { Document, BlockNote, Block, Inline } from '#src/types/ast.generated';
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
 */
function hashContent(text: string): string {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Assign hash-based IDs to note blocks without explicit IDs
 */
function buildNoteIndex(document: Document): void {
    const usedIds = new Set<string>();

    walkDocument(document, {
        visitNote: (note: BlockNote) => {
            if (note.id) {
                usedIds.add(note.id);
                return;
            }

            const prefix = note.noteType || 'note';
            const contentText = extractBlockText(note.children as Block[]);
            const contentHash = hashContent(contentText);
            let candidateId = `${prefix}-${contentHash}`;

            // Ensure uniqueness
            let suffix = 2;
            while (usedIds.has(candidateId)) {
                candidateId = `${prefix}-${contentHash}-${suffix}`;
                suffix++;
            }

            note.id = candidateId;
            usedIds.add(note.id);
        }
    });
}

/**
 * Note index plugin
 */
export const noteIndexPlugin: Plugin = {
    name: 'note-index',
    order: { index: 16 }, // Run after example-index

    async index(ctx: IndexContext): Promise<void> {
        buildNoteIndex(ctx.document);
    },
};
