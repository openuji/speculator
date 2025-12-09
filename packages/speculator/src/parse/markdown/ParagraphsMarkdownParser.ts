/**
 * Paragraphs Markdown Parser
 * 
 * Handles mdast paragraph nodes → BlockParagraph AST nodes.
 */

import type { Paragraph, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockParagraph } from '#src/types/ast.generated';

/**
 * Markdown parser module for paragraph nodes.
 */
export const ParagraphsMarkdownParser: MarkdownParserModule = {
    name: 'ParagraphsMarkdownParser',
    handles: ['paragraph'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockParagraph | null {
        const paragraphNode = node as Paragraph;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockParagraph = {
            type: 'paragraph',
            children: ctx.transformInlineChildren(paragraphNode.children),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
