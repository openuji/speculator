/**
 * Markdown Heading Handler
 */

import type { Heading, RootContent } from 'mdast';
import type { BlockHeading } from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext } from '#src/parse/registry';

/**
 * Handler for heading nodes
 */
export const headingHandler: MdNodeHandler = {
    nodeTypes: ['heading'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockHeading {
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
