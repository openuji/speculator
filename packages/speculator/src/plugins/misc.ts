/**
 * Misc Plugin
 * 
 * Handles miscellaneous elements: thematic break (hr), containers, raw HTML.
 */

import type { Element, RootContent } from 'hast';
import type { ThematicBreak, Html, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockThematicBreak, BlockHtml, Section, Block } from '#src/types/ast.generated';

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

                // Container elements - pass through children
                if (tagName === 'div' || tagName === 'article' || tagName === 'main' || tagName === 'body') {
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
