/**
 * Markdown Blockquote Handler
 */

import type { Blockquote, RootContent } from 'mdast';
import type { BlockQuote, Block } from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext } from '#src/parse/registry';

/**
 * Handler for blockquote nodes
 */
export const blockquoteHandler: MdNodeHandler = {
    nodeTypes: ['blockquote'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockQuote {
        const quoteNode = node as Blockquote;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockQuote = {
            type: 'blockquote',
            children: ctx.transformBlockChildren(quoteNode.children)
                .filter((n): n is Block => n !== null),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
