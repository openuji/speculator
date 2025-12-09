/**
 * Lists HTML Parser
 * 
 * Handles ul/ol HTML elements → BlockList AST nodes.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockList, ListItem, Block, BlockParagraph } from '#src/types/ast.generated';

/**
 * Transform an HTML list item element
 */
function transformHtmlListItem(element: Element, ctx: ParseContext): ListItem {
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
            const para: BlockParagraph = {
                type: 'paragraph',
                children: inlines,
            };
            result.children = [para];
        }
    }

    if (checked !== undefined) result.checked = checked;
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

/**
 * HTML parser module for list elements (ul, ol).
 */
export const ListsHtmlParser: HtmlParserModule = {
    name: 'ListsHtmlParser',
    handles: ['ul', 'ol'],
    order: 10,

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const sourcePos = ctx.createSourcePos(element);
        const tagName = element.tagName.toLowerCase();

        const result: BlockList = {
            type: 'list',
            ordered: tagName === 'ol',
            children: element.children
                .filter((c): c is Element => c.type === 'element' && (c as Element).tagName === 'li')
                .map(li => transformHtmlListItem(li, ctx)),
        };

        const start = ctx.getAttr(element, 'start');
        if (start) result.start = parseInt(start, 10);
        const id = ctx.getAttr(element, 'id');
        if (id) result.id = id;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
