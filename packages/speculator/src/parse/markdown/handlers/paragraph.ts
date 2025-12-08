/**
 * Markdown Paragraph Handler
 */

import type { Paragraph, RootContent } from 'mdast';
import type { BlockParagraph } from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext } from '#src/parse/registry';

/**
 * Handler for paragraph nodes
 */
export const paragraphHandler: MdNodeHandler = {
    nodeTypes: ['paragraph'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockParagraph {
        const paraNode = node as Paragraph;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockParagraph = {
            type: 'paragraph',
            children: ctx.transformInlineChildren(paraNode.children),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
