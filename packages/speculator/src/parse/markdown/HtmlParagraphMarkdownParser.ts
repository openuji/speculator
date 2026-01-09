/**
 * HTML Paragraph Markdown Parser
 * 
 * Handles paragraphs containing inline HTML nodes in mdast by re-parsing
 * with rehype to support multi-node tags like <dfn>...</dfn>.
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Html, Text, Paragraph, RootContent as MdastRootContent } from 'mdast';
import type { Root, RootContent } from 'hast';
import { type MarkdownParserModule, type ParseContext, type InlineHandlerResult, type BlockHandlerResult } from '#src/parse/registry';
import type { Inline, BlockParagraph } from '#src/types/ast.generated';
import { createHastContext, transformHastInline } from '#src/parse/utils/hast-utils';

/**
 * Markdown parser module for paragraphs containing HTML nodes.
 * 
 * When a paragraph contains inline HTML (e.g., `<dfn>term</dfn>`),
 * this parser takes over to properly reconstruct the HTML elements.
 */
export const HtmlParagraphMarkdownParser: MarkdownParserModule = {
    name: 'HtmlParagraphMarkdownParser',
    handles: ['paragraph'],
    order: 4, // Higher priority than standard ParagraphsMarkdownParser (10)

    handleInline(_node: MdastRootContent, _ctx: ParseContext): InlineHandlerResult {
        return null;
    },

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHandlerResult {
        if (node.type !== 'paragraph') return null;

        const paraNode = node as Paragraph;
        
        // Only take over if paragraph contains HTML nodes
        if (!paraNode.children.some(c => c.type === 'html')) {
            return null;
        }

        // Concatenate all text and html into raw HTML string
        let rawHtml = '';
        for (const child of paraNode.children) {
            if (child.type === 'text') {
                rawHtml += (child as Text).value;
            } else if (child.type === 'html') {
                rawHtml += (child as Html).value;
            }
            // Other node types (if any) are skipped since we're order 4
        }

        // Re-parse as HTML to get proper element structure
        const processor = unified().use(rehypeParse, { fragment: true });
        const tree = processor.parse(rawHtml) as Root;
        const hastCtx = createHastContext(ctx);

        // Transform hast children to Speculator inlines
        const children: Inline[] = [];
        for (const child of tree.children) {
            const res = transformHastInline(child as RootContent, hastCtx);
            if (res) {
                if (Array.isArray(res)) children.push(...res);
                else children.push(res);
            }
        }

        const result: BlockParagraph = {
            type: 'paragraph',
            children,
        };
        const sourcePos = ctx.createSourcePos(node);
        if (sourcePos) result.sourcePos = sourcePos;
        return result;
    }
};
