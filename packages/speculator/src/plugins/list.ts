/**
 * List Plugin
 * 
 * Handles ul/ol/li HTML elements and Markdown list nodes.
 */

import type { Element, RootContent } from 'hast';
import type { List, ListItem as MdastListItem, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockList, ListItem, Block, BlockParagraph } from '#src/types/ast.generated';

/**
 * Transform a Markdown list item node
 */
function transformMdListItem(node: MdastListItem, ctx: ParseContext): ListItem {
    const sourcePos = ctx.createSourcePos(node);

    const result: ListItem = {
        type: 'listItem',
        children: ctx.transformBlockChildren(node.children)
            .filter((n): n is Block => n !== null && n.type !== 'section'),
    };

    if (node.checked !== undefined && node.checked !== null) {
        result.checked = node.checked;
    }
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

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
 * Plugin for list elements (ul, ol, li) and Markdown lists.
 */
export const listPlugin: Plugin = {
    name: 'list',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['ul', 'ol'],

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
        },

        markdown: {
            nodeTypes: ['list'],

            handleBlock(node: MdastRootContent, ctx: ParseContext): BlockList | null {
                const listNode = node as List;
                const sourcePos = ctx.createSourcePos(node);

                const result: BlockList = {
                    type: 'list',
                    ordered: listNode.ordered ?? false,
                    children: listNode.children.map(item => transformMdListItem(item, ctx)),
                };

                if (listNode.start !== undefined && listNode.start !== null) {
                    result.start = listNode.start;
                }
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },
    },
};
