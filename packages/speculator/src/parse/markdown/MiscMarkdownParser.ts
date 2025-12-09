/**
 * Misc Markdown Parser
 * 
 * Handles miscellaneous mdast nodes: thematic break, raw HTML.
 */

import type { ThematicBreak, Html, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockThematicBreak, BlockHtml, Block } from '#src/types/ast.generated';

/**
 * Markdown parser module for miscellaneous nodes.
 */
export const MiscMarkdownParser: MarkdownParserModule = {
    name: 'MiscMarkdownParser',
    handles: ['thematicBreak', 'html'],
    order: 20, // Lower priority than content parsers

    handleBlock(node: MdastRootContent, ctx: ParseContext): Block | null {
        const sourcePos = ctx.createSourcePos(node);

        // Thematic break
        if (node.type === 'thematicBreak') {
            const result: BlockThematicBreak = {
                type: 'thematicBreak',
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Raw HTML in markdown
        if (node.type === 'html') {
            const htmlNode = node as Html;
            const result: BlockHtml = {
                type: 'html',
                value: htmlNode.value,
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        return null;
    },
};
