/**
 * Code Markdown Parser
 * 
 * Handles mdast code nodes → BlockCodeBlock AST nodes.
 */

import type { Code, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockCodeBlock, BlockIdl } from '#src/types/ast.generated';
import { tokenizeIdlContent } from '#src/parse/utils/idl-tokenizer';

function normalizeLanguage(lang?: string | null): string | undefined {
    if (!lang) return undefined;
    const normalized = lang.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}

/**
 * Markdown parser module for code block nodes.
 */
export const CodeMarkdownParser: MarkdownParserModule = {
    name: 'CodeMarkdownParser',
    handles: ['code'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHandlerResult {
        const codeNode = node as Code;
        const sourcePos = ctx.createSourcePos(node);
        const lang = normalizeLanguage(codeNode.lang);

        if (lang === 'webidl' || lang === 'idl') {
            const idlBlock: BlockIdl = {
                type: 'idl',
                value: codeNode.value,
                children: tokenizeIdlContent(codeNode.value, sourcePos),
            };
            if (sourcePos) idlBlock.sourcePos = sourcePos;
            return idlBlock;
        }

        const result: BlockCodeBlock = {
            type: 'codeBlock',
            value: codeNode.value,
            children: [],
        };

        if (lang) result.lang = lang;
        if (codeNode.meta) result.meta = codeNode.meta;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
