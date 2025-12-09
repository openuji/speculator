/**
 * Lists Markdown Parser
 * 
 * Handles mdast list nodes → BlockList AST nodes.
 */

import type { List, ListItem as MdastListItem, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockList, ListItem, Block } from '#src/types/ast.generated';

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
 * Markdown parser module for list nodes.
 */
export const ListsMarkdownParser: MarkdownParserModule = {
    name: 'ListsMarkdownParser',
    handles: ['list'],
    order: 10,

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
};
