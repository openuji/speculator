/**
 * Aside/Note HTML Parser
 * 
 * Handles <aside>, <div class="note">, <div class="example">, etc.
 * These containers mark informative content for citation classification.
 */

import type { Element, RootContent } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockNote, Block } from '#src/types/ast.generated';

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
 * HTML parser module for aside and note-type elements.
 */
export const AsideHtmlParser: HtmlParserModule = {
    name: 'AsideHtmlParser',
    handles: ['aside', 'div'],
    order: 8, // Run before misc parser but after specialized handlers

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
                // Not a note-type div - pass through children
                return ctx.transformBlockChildren(element.children as RootContent[]);
            }
        }

        const sourcePos = ctx.createSourcePos(element);
        const id = ctx.getAttr(element, 'id');

        // Transform children to blocks (notes should not contain sections)
        const childBlocks = ctx.transformBlockChildren(element.children as RootContent[]);
        // Filter out sections if any - notes only contain blocks
        const children = childBlocks.filter((c): c is Block =>
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
};
