/**
 * Aside/Note Plugin
 * 
 * Handles <aside>, <div class="note">, <div class="example">, etc.
 * These containers mark informative content for citation classification.
 */

import type { Element, RootContent } from 'hast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockNote } from '#src/types/ast.generated';

/**
 * Note type classifications
 */
const NOTE_CLASSES = ['note', 'warning', 'example', 'issue', 'advisement'] as const;
type NoteType = 'note' | 'warning' | 'example' | 'issue';

/**
 * Check if element has a note-like class
 */
function getNoteType(element: Element, ctx: ParseContext): NoteType | null {
    // hast converts 'class' to 'className' 
    const className = ctx.getAttr(element, 'className') ?? '';
    const classes = className.toLowerCase().split(/\s+/);

    for (const noteClass of NOTE_CLASSES) {
        if (classes.includes(noteClass)) {
            // Map advisement to warning
            if (noteClass === 'advisement') return 'warning';
            return noteClass as NoteType;
        }
    }

    // Check role attribute
    const role = ctx.getAttr(element, 'role');
    if (role === 'note') return 'note';

    return null;
}

/**
 * Plugin for aside and note-type elements.
 */
export const asidePlugin: Plugin = {
    name: 'aside',
    order: { parse: 8 }, // Run before misc plugin but after specialized handlers

    parse: {
        html: {
            tags: ['aside', 'div'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const tagName = element.tagName.toLowerCase();

                // For <aside>, always treat as note
                // For <div>, only if it has a note class
                let noteType: NoteType | null;

                if (tagName === 'aside') {
                    noteType = getNoteType(element, ctx) ?? 'note';
                } else {
                    // tagName === 'div'
                    noteType = getNoteType(element, ctx);
                    if (!noteType) {
                        // Not a note-type div, let misc plugin handle it
                        return null;
                    }
                }

                const sourcePos = ctx.createSourcePos(element);
                const id = ctx.getAttr(element, 'id');

                // Transform children to blocks (notes should not contain sections)
                const childBlocks = ctx.transformBlockChildren(element.children as RootContent[]);
                // Filter out sections if any - notes only contain blocks
                const children = childBlocks.filter((c): c is import('#src/types/ast.generated').Block =>
                    c.type !== 'section'
                );

                const result: BlockNote = {
                    type: 'note',
                    noteType,
                    informative: true, // Always informative
                    children,
                };

                if (id) result.id = id;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },
    },
};
