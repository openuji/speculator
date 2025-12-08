/**
 * Misc Plugin
 * 
 * Handles miscellaneous elements: thematic break (hr), containers, raw HTML.
 * Also handles div elements with note/warning/example classes as informative blocks.
 */

import type { Element, RootContent } from 'hast';
import type { ThematicBreak, Html, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockThematicBreak, BlockHtml, BlockNote, Section, Block } from '#src/types/ast.generated';

/**
 * Note type classifications
 */
const NOTE_CLASSES = ['note', 'warning', 'example', 'issue', 'advisement'] as const;
type NoteType = 'note' | 'warning' | 'example' | 'issue';

/**
 * Check if element has a note-like class
 */
function getNoteTypeFromDiv(element: Element, ctx: ParseContext): NoteType | null {
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

    return null;
}

/**
 * Plugin for miscellaneous elements.
 */
export const miscPlugin: Plugin = {
    name: 'misc',
    order: { parse: 20 },  // Lower priority than content plugins

    parse: {
        html: {
            tags: ['hr', 'div', 'article', 'main', 'body', 'html', 'head', 'script', 'style', 'meta', 'link', 'title'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const tagName = element.tagName.toLowerCase();
                const sourcePos = ctx.createSourcePos(element);

                // Thematic break (hr)
                if (tagName === 'hr') {
                    const result: BlockThematicBreak = {
                        type: 'thematicBreak',
                    };
                    const id = ctx.getAttr(element, 'id');
                    if (id) result.id = id;
                    if (sourcePos) result.sourcePos = sourcePos;
                    return result;
                }

                // Container elements
                if (tagName === 'div') {
                    // Check for note/warning/example class
                    const noteType = getNoteTypeFromDiv(element, ctx);
                    if (noteType) {
                        const id = ctx.getAttr(element, 'id');
                        const childBlocks = ctx.transformBlockChildren(element.children as RootContent[]);
                        // Filter out sections - notes only contain blocks
                        const children = childBlocks.filter((c): c is Block => c.type !== 'section');

                        const result: BlockNote = {
                            type: 'note',
                            noteType,
                            informative: true,
                            children,
                        };

                        if (id) result.id = id;
                        if (sourcePos) result.sourcePos = sourcePos;
                        return result;
                    }

                    // Regular div - pass through children
                    return ctx.transformBlockChildren(element.children) as (Section | Block)[];
                }

                // Other container elements - pass through children
                if (tagName === 'article' || tagName === 'main' || tagName === 'body') {
                    return ctx.transformBlockChildren(element.children) as (Section | Block)[];
                }

                // Skip elements (don't render)
                if (['html', 'head', 'script', 'style', 'meta', 'link', 'title'].includes(tagName)) {
                    return null;
                }

                return null;
            },
        },

        markdown: {
            nodeTypes: ['thematicBreak', 'html'],

            handleBlock(node: MdastRootContent, ctx: ParseContext): Block | null {
                const sourcePos = ctx.createSourcePos(node);

                // Thematic break
                if (node.type === 'thematicBreak') {
                    const result: BlockThematicBreak = {
                        type: 'thematicBreak',
                    };
                    if (sourcePos) result.sourcePos = sourcePos;
                    return result;
                }

                // Raw HTML in markdown
                if (node.type === 'html') {
                    const htmlNode = node as Html;
                    const result: BlockHtml = {
                        type: 'html',
                        value: htmlNode.value,
                    };
                    if (sourcePos) result.sourcePos = sourcePos;
                    return result;
                }

                return null;
            },
        },
    },
};
