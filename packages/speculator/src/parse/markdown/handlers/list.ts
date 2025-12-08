/**
 * Markdown List Handler
 */

import type { List, ListItem as MdastListItem, RootContent } from 'mdast';
import type { BlockList, ListItem, Block } from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext } from '#src/parse/registry';

/**
 * Handler for list nodes
 */
export const listHandler: MdNodeHandler = {
    nodeTypes: ['list'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockList {
        const listNode = node as List;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockList = {
            type: 'list',
            ordered: listNode.ordered ?? false,
            children: listNode.children.map(item => transformListItem(item, ctx)),
        };

        if (listNode.start !== undefined && listNode.start !== null) {
            result.start = listNode.start;
        }
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Transform a list item node
 */
function transformListItem(node: MdastListItem, ctx: MdParseContext): ListItem {
    const sourcePos = ctx.createSourcePos(node);

    const result: ListItem = {
        type: 'listItem',
        children: ctx.transformBlockChildren(node.children)
            .filter((n): n is Block => n !== null),
    };

    if (node.checked !== undefined && node.checked !== null) {
        result.checked = node.checked;
    }
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}
