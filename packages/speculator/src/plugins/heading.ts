/**
 * Heading Plugin
 * 
 * Handles h1-h6 HTML elements and Markdown heading nodes.
 */

import type { Element } from 'hast';
import type { Heading, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockHeading } from '#src/types/ast.generated';

/**
 * Plugin for heading elements (h1-h6) and Markdown headings.
 */
export const headingPlugin: Plugin = {
    name: 'heading',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const sourcePos = ctx.createSourcePos(element);
                const tagName = element.tagName.toLowerCase();
                const depth = parseInt(tagName.match(/^h([1-6])$/i)?.[1] ?? '1', 10) as 1 | 2 | 3 | 4 | 5 | 6;

                const result: BlockHeading = {
                    type: 'heading',
                    depth,
                    children: ctx.transformInlineChildren(element.children),
                };

                const id = ctx.getAttr(element, 'id');
                if (id) result.id = id;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },

        markdown: {
            nodeTypes: ['heading'],

            handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHeading | null {
                const headingNode = node as Heading;
                const sourcePos = ctx.createSourcePos(node);

                const result: BlockHeading = {
                    type: 'heading',
                    depth: headingNode.depth,
                    children: ctx.transformInlineChildren(headingNode.children),
                };

                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },
    },
};
