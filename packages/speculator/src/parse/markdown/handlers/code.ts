/**
 * Markdown Code Handler
 */

import type { Code, RootContent } from 'mdast';
import type { BlockCodeBlock } from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext } from '#src/parse/registry';

/**
 * Handler for code block nodes
 */
export const codeHandler: MdNodeHandler = {
    nodeTypes: ['code'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockCodeBlock {
        const codeNode = node as Code;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockCodeBlock = {
            type: 'codeBlock',
            value: codeNode.value,
        };

        if (codeNode.lang) result.lang = codeNode.lang;
        if (codeNode.meta) result.meta = codeNode.meta;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
