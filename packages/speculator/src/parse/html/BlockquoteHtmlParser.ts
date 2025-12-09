/**
 * Blockquote HTML Parser
 * 
 * Handles blockquote HTML elements → BlockQuote AST nodes.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockQuote, Block } from '#src/types/ast.generated';

/**
 * HTML parser module for blockquote elements.
 */
export const BlockquoteHtmlParser: HtmlParserModule = {
    name: 'BlockquoteHtmlParser',
    handles: ['blockquote'],
    order: 10,

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
};
