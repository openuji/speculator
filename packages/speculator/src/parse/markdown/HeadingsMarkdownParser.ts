/**
 * Headings Markdown Parser
 * 
 * Handles mdast heading nodes → BlockHeading AST nodes.
 */

import type { Heading, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockHeading } from '#src/types/ast.generated';

/**
 * Markdown parser module for heading nodes.
 */
export const HeadingsMarkdownParser: MarkdownParserModule = {
    name: 'HeadingsMarkdownParser',
    handles: ['heading'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHeading | null {
        const headingNode = node as Heading;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockHeading = {
            type: 'heading',
            depth: headingNode.depth,
            children: ctx.transformInlineChildren(headingNode.children),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
