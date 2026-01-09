/**
 * HTML Inlines Markdown Parser
 * 
 * Handles inline HTML nodes in mdast by grouping them within paragraphs
 * and parsing with rehype to support multi-node tags like <dfn>...</dfn>.
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Html, Text, Paragraph, RootContent as MdastRootContent } from 'mdast';
import type { Element, Text as HastText, Root, RootContent as HastRootContent } from 'hast';
import { type MarkdownParserModule, type ParseContext, type InlineHandlerResult, type BlockHandlerResult } from '#src/parse/registry';
import type { Inline, BlockParagraph } from '#src/types/ast.generated';

/**
 * Get element attribute value (mirrors logic from html/parser.ts)
 */
function getAttr(element: Element, name: string): string | undefined {
    const val = element.properties?.[name];
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' ');
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean' && val) return name;
    return undefined;
}

/**
 * Get text content of element recursively (mirrors logic from html/parser.ts)
 */
function getTextContent(element: Element): string {
    let text = '';
    for (const child of element.children) {
        if (child.type === 'text') {
            text += (child as HastText).value;
        } else if (child.type === 'element') {
            text += getTextContent(child as Element);
        }
    }
    return text;
}

/**
 * Transform a hast node to Speculator inline(s) using HTML handlers
 */
function transformHastInline(node: HastRootContent, ctx: ParseContext): Inline | Inline[] | null {
    if (node.type === 'text') {
        const textValue = (node as HastText).value;
        // Delegate back to Markdown's transformInlineChildren to handle shorthands (|var|)
        const res = ctx.transformInlineChildren([{ type: 'text', value: textValue } as Text]);
        return res.length === 0 ? null : res;
    }

    if (node.type !== 'element') return null;

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Look up handler in the registry provided in the context
    const handler = ctx.registry.getHtmlInlineHandler(tagName);

    if (handler?.handleInline) {
        return handler.handleInline(element, ctx);
    }

    // Fallback: recurse into children if no handler for this tag
    return ctx.transformInlineChildren(element.children);
}

/**
 * Create a hast-aware ParseContext from a base (markdown) context
 */
function createHastContext(ctx: ParseContext): ParseContext {
    const originalTransform = ctx.transformInlineChildren;
    const hastCtx: ParseContext = {
        ...ctx,
        transformInlineChildren: (children) => {
            const results: Inline[] = [];
            for (const child of children as any[]) {
                if (child.type === 'element') {
                    const res = transformHastInline(child, hastCtx);
                    if (res) {
                        if (Array.isArray(res)) results.push(...res);
                        else results.push(res);
                    }
                } else {
                    // Delegate anything else (text, mdast nodes) to the original transformer
                    results.push(...originalTransform([child]));
                }
            }
            return results;
        },
        getTextContent,
        getAttr,
    };
    return hastCtx;
}

/**
 * Markdown parser module for HTML nodes.
 */
export const HtmlInlinesMarkdownParser: MarkdownParserModule = {
    name: 'HtmlInlinesMarkdownParser',
    handles: ['html', 'paragraph'],
    order: 4, // Higher priority than standard ParagraphsMarkdownParser (10)

    handleInline(_node: MdastRootContent, _ctx: ParseContext): InlineHandlerResult {
        // Individual inline HTML nodes are now handled via the paragraph grouper.
        return null; 
    },

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHandlerResult {
        // 1. Handle Paragraph Grouping
        if (node.type === 'paragraph') {
            const paraNode = node as Paragraph;
            // Only take over if it contains HTML
            if (paraNode.children.some(c => c.type === 'html')) {
                let rawHtml = '';
                for (const child of paraNode.children) {
                    if (child.type === 'text') {
                        rawHtml += (child as Text).value;
                    } else if (child.type === 'html') {
                        rawHtml += (child as Html).value;
                    } else {
                        // For other nodes (if any already processed), we'd need serialization.
                        // Since we are order 4, it's mostly text/html.
                    }
                }

                const processor = unified().use(rehypeParse, { fragment: true });
                const tree = processor.parse(rawHtml) as Root;
                const hastCtx = createHastContext(ctx);

                const children: Inline[] = [];
                for (const child of tree.children) {
                    const res = transformHastInline(child as any, hastCtx);
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
            
            return null;
        }

        // 2. Handle Block-level HTML
        if (node.type === 'html') {
            const htmlNode = node as Html;
            const html = htmlNode.value;

            const processor = unified().use(rehypeParse, { fragment: true });
            const tree = processor.parse(html) as Root;

            if (tree.children.length === 0) return null;

            const hastCtx = createHastContext(ctx);

            // For blocks, we look at the first top-level element
            const firstElement = tree.children.find((c): c is Element => c.type === 'element');
            if (!firstElement) {
                // Wrap in paragraph
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const children = hastCtx.transformInlineChildren(tree.children as any);
                return {
                    type: 'paragraph',
                    children,
                    sourcePos: ctx.createSourcePos(node),
                };
            }

            const tagName = firstElement.tagName.toLowerCase();
            const handler = ctx.registry.getHtmlBlockHandler(tagName);

            if (handler?.handleBlock) {
                const result = handler.handleBlock(firstElement as Element, hastCtx);
                if (Array.isArray(result)) return result[0] || null;
                return result;
            }

            // Fallback: handle as inlines wrapped in paragraph
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const children = hastCtx.transformInlineChildren(tree.children as any);
            return {
                type: 'paragraph',
                children,
                sourcePos: ctx.createSourcePos(node),
            };
        }

        return null;
    }
};
