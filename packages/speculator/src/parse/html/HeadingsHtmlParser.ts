/**
 * Headings HTML Parser
 * 
 * Handles h1-h6 HTML elements → BlockHeading AST nodes.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockHeading } from '#src/types/ast.generated';

/**
 * HTML parser module for heading elements (h1-h6).
 */
export const HeadingsHtmlParser: HtmlParserModule = {
    name: 'HeadingsHtmlParser',
    handles: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    order: 10,

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
};
