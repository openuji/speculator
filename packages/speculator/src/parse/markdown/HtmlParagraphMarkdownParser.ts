/**
 * HTML Paragraph Markdown Parser
 * 
 * Handles paragraphs containing inline HTML nodes in mdast by re-parsing
 * with rehype to support multi-node tags like <dfn>...</dfn>.
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Paragraph, RootContent as MdastRootContent } from 'mdast';
import type { Root } from 'hast';
import { type MarkdownParserModule, type ParseContext, type InlineHandlerResult, type BlockHandlerResult } from '#src/parse/registry';
import type { BlockParagraph } from '#src/types/ast.generated';
import { createHastContext } from '#src/parse/utils/hast-utils';

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

        // Use original source text if position is available to preserve all content (including Markdown)
        let rawHtml = '';
        if (paraNode.position) {
            const { start, end } = paraNode.position;
            if (start.offset !== undefined && end.offset !== undefined) {
                rawHtml = ctx.unit.content.slice(start.offset, end.offset);
            }
        }

        if (!rawHtml) {
            // Fallback: Concatenate all text and html into raw HTML string
            for (const child of paraNode.children) {
                if ('value' in child && typeof child.value === 'string') {
                    rawHtml += child.value;
                }
            }
        }

        // Re-parse as HTML to get proper element structure
        const processor = unified().use(rehypeParse, { fragment: true });
        const tree = processor.parse(rawHtml) as Root;
        const sourcePos = ctx.createSourcePos(node);
        const hastCtx = createHastContext(ctx, sourcePos);

        // Transform all children using hast block transformation
        const results = hastCtx.transformBlockChildren(tree.children);
        
        if (results.length > 0) {
            return results;
        }

        // Fallback: wrap as inlines in paragraph
        const children = hastCtx.transformInlineChildren(tree.children);
        const result: BlockParagraph = {
            type: 'paragraph',
            children,
        };
        if (sourcePos) result.sourcePos = sourcePos;
        return result;
    }
};
