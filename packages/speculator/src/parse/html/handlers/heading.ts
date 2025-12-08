/**
 * HTML Heading Handler
 */

import type { Element } from 'hast';
import type { BlockHeading } from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext } from '#src/parse/registry';

/**
 * Handler for h1-h6 elements
 */
export const headingHandler: HtmlTagHandler = {
    tags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

    handleBlock(element: Element, ctx: HtmlParseContext): BlockHeading {
        const sourcePos = ctx.createSourcePos(element);
        const tagName = element.tagName.toLowerCase();
        const depth = parseInt(tagName.match(/^h([1-6])$/i)?.[1] ?? '1', 10);

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
