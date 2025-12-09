/**
 * Code Markdown Parser
 * 
 * Handles mdast code nodes → BlockCodeBlock AST nodes.
 */

import type { Code, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockCodeBlock } from '#src/types/ast.generated';

/**
 * Markdown parser module for code block nodes.
 */
export const CodeMarkdownParser: MarkdownParserModule = {
    name: 'CodeMarkdownParser',
    handles: ['code'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockCodeBlock | null {
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
