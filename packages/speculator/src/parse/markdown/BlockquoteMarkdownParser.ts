/**
 * Blockquote Markdown Parser
 * 
 * Handles mdast blockquote nodes → BlockQuote AST nodes.
 */

import type { Blockquote, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockQuote, Block } from '#src/types/ast.generated';

/**
 * Markdown parser module for blockquote nodes.
 */
export const BlockquoteMarkdownParser: MarkdownParserModule = {
    name: 'BlockquoteMarkdownParser',
    handles: ['blockquote'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockQuote | null {
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
