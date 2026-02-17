/**
 * HTML Block Markdown Parser
 * 
 * Handles standalone block-level HTML nodes in mdast (e.g., <aside>, <figure>).
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Html, RootContent as MdastRootContent } from 'mdast';
import type { Root, RootContent } from 'hast';
import { type MarkdownParserModule, type ParseContext, type InlineHandlerResult, type BlockHandlerResult } from '#src/parse/registry';
import { createHastContext } from '#src/parse/utils/hast-utils';

/**
 * Markdown parser module for block-level HTML nodes.
 * 
 * Handles standalone HTML blocks like `<aside>...</aside>` or `<figure>`.
 */
export const HtmlBlockMarkdownParser: MarkdownParserModule = {
    name: 'HtmlBlockMarkdownParser',
    handles: ['html'],
    order: 4, // Higher priority than fallback parsers

    handleInline(_node: MdastRootContent, _ctx: ParseContext): InlineHandlerResult {
        return null;
    },

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHandlerResult {
        if (node.type !== 'html') return null;

        const htmlNode = node as Html;
        // Restore blank lines preserved by markdown-utils
        const html = htmlNode.value.replace(/__SPECULATOR_BLANK_LINE__/g, '\n');
        

        // Parse HTML to get proper element structure
        const processor = unified().use(rehypeParse, { fragment: true });
        const tree = processor.parse(html) as Root;
        
        if (tree.children.length === 0) return null;

        const sourcePos = ctx.createSourcePos(node);
        const hastCtx = createHastContext(ctx, sourcePos);

        // Transform all children using hast block transformation
        const results = hastCtx.transformBlockChildren(tree.children);
        
        if (results.length > 0) {
            return results;
        }

        // Fallback: wrap as inlines in paragraph (for text-only blocks)
        const children = hastCtx.transformInlineChildren(tree.children as RootContent[]);
        return {
            type: 'paragraph',
            children,
            sourcePos,
        };
    }
};
