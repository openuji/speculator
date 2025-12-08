/**
 * Markdown Miscellaneous Handlers
 * 
 * Handles thematicBreak and html nodes.
 */

import type { ThematicBreak, Html, RootContent } from 'mdast';
import type { BlockThematicBreak, BlockHtml } from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext } from '#src/parse/registry';

/**
 * Handler for thematic break nodes (horizontal rules)
 */
export const thematicBreakHandler: MdNodeHandler = {
    nodeTypes: ['thematicBreak'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockThematicBreak {
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockThematicBreak = {
            type: 'thematicBreak',
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Handler for raw HTML nodes in markdown
 */
export const htmlHandler: MdNodeHandler = {
    nodeTypes: ['html'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockHtml {
        const htmlNode = node as Html;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockHtml = {
            type: 'html',
            value: htmlNode.value,
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
