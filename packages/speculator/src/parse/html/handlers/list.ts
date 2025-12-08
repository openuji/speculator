/**
 * HTML List Handler
 */

import type { Element } from 'hast';
import type { BlockList, ListItem, Block } from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext, BlockHandlerResult } from '#src/parse/registry';

/**
 * Handler for <ul>, <ol> elements
 */
export const listHandler: HtmlTagHandler = {
    tags: ['ul', 'ol'],

    handleBlock(element: Element, ctx: HtmlParseContext): BlockList {
        const sourcePos = ctx.createSourcePos(element);
        const tagName = element.tagName.toLowerCase();

        const result: BlockList = {
            type: 'list',
            ordered: tagName === 'ol',
            children: element.children
                .filter((c): c is Element => c.type === 'element' && (c as Element).tagName === 'li')
                .map(li => transformListItem(li, ctx)),
        };

        const start = ctx.getAttr(element, 'start');
        if (start) result.start = parseInt(start, 10);
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Transform a list item element
 */
function transformListItem(element: Element, ctx: HtmlParseContext): ListItem {
    const sourcePos = ctx.createSourcePos(element);

    // Check for task list checkbox
    let checked: boolean | null | undefined;
    const firstChild = element.children[0];
    if (firstChild?.type === 'element') {
        const firstEl = firstChild as Element;
        if (firstEl.tagName === 'input' && ctx.getAttr(firstEl, 'type') === 'checkbox') {
            checked = firstEl.properties?.checked === true;
        }
    }

    const blocks = ctx.transformBlockChildren(element.children)
        .filter((n): n is Block => n !== null && n.type !== 'section');

    const result: ListItem = {
        type: 'listItem',
        children: blocks,
    };

    // If no block children, wrap inline content in paragraph
    if (result.children.length === 0) {
        const inlines = ctx.transformInlineChildren(element.children);
        if (inlines.length > 0) {
            result.children = [{
                type: 'paragraph',
                children: inlines,
            }];
        }
    }

    if (checked !== undefined) result.checked = checked;
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}
