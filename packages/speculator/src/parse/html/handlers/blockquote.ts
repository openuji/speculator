/**
 * HTML Blockquote Handler
 */

import type { Element } from 'hast';
import type { BlockQuote, Block } from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext } from '#src/parse/registry';

/**
 * Handler for <blockquote> elements
 */
export const blockquoteHandler: HtmlTagHandler = {
    tags: ['blockquote'],

    handleBlock(element: Element, ctx: HtmlParseContext): BlockQuote {
        const sourcePos = ctx.createSourcePos(element);

        const result: BlockQuote = {
            type: 'blockquote',
            children: ctx.transformBlockChildren(element.children)
                .filter((n): n is Block => n !== null && n.type !== 'section'),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
