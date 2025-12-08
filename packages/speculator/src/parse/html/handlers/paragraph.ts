/**
 * HTML Paragraph Handler
 */

import type { Element } from 'hast';
import type { BlockParagraph } from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext } from '#src/parse/registry';

/**
 * Handler for <p> elements
 */
export const paragraphHandler: HtmlTagHandler = {
    tags: ['p'],

    handleBlock(element: Element, ctx: HtmlParseContext): BlockParagraph {
        const sourcePos = ctx.createSourcePos(element);

        const result: BlockParagraph = {
            type: 'paragraph',
            children: ctx.transformInlineChildren(element.children),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
