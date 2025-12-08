/**
 * Paragraph Plugin
 * 
 * Handles p HTML elements and Markdown paragraph nodes.
 */

import type { Element } from 'hast';
import type { Paragraph, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockParagraph } from '#src/types/ast.generated';

/**
 * Plugin for paragraph elements.
 */
export const paragraphPlugin: Plugin = {
    name: 'paragraph',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['p'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const sourcePos = ctx.createSourcePos(element);
                const children = ctx.transformInlineChildren(element.children);

                if (children.length === 0) return null;

                const result: BlockParagraph = {
                    type: 'paragraph',
                    children,
                };

                const id = ctx.getAttr(element, 'id');
                if (id) result.id = id;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },

        markdown: {
            nodeTypes: ['paragraph'],

            handleBlock(node: MdastRootContent, ctx: ParseContext): BlockParagraph | null {
                const paragraphNode = node as Paragraph;
                const sourcePos = ctx.createSourcePos(node);

                const result: BlockParagraph = {
                    type: 'paragraph',
                    children: ctx.transformInlineChildren(paragraphNode.children),
                };

                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },
    },
};
