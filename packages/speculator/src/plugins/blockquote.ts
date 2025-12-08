/**
 * Blockquote Plugin
 * 
 * Handles blockquote HTML elements and Markdown blockquote nodes.
 */

import type { Element } from 'hast';
import type { Blockquote, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockQuote, Block } from '#src/types/ast.generated';

/**
 * Plugin for blockquote elements.
 */
export const blockquotePlugin: Plugin = {
    name: 'blockquote',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['blockquote'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const sourcePos = ctx.createSourcePos(element);

                const result: BlockQuote = {
                    type: 'blockquote',
                    children: ctx.transformBlockChildren(element.children)
                        .filter((n): n is Block => n !== null && n.type !== 'section'),
                };

                const id = ctx.getAttr(element, 'id');
                if (id) result.id = id;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },

        markdown: {
            nodeTypes: ['blockquote'],

            handleBlock(node: MdastRootContent, ctx: ParseContext): BlockQuote | null {
                const quoteNode = node as Blockquote;
                const sourcePos = ctx.createSourcePos(node);

                const result: BlockQuote = {
                    type: 'blockquote',
                    children: ctx.transformBlockChildren(quoteNode.children)
                        .filter((n): n is Block => n !== null),
                };

                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },
    },
};
