/**
 * Paragraphs HTML Parser
 * 
 * Handles p HTML elements → BlockParagraph AST nodes.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockParagraph } from '#src/types/ast.generated';

/**
 * HTML parser module for paragraph elements.
 */
export const ParagraphsHtmlParser: HtmlParserModule = {
    name: 'ParagraphsHtmlParser',
    handles: ['p'],
    order: 10,

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
};
