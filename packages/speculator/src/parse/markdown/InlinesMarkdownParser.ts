/**
 * Inlines Markdown Parser
 * 
 * Handles mdast inline nodes: text, emphasis, strong, inlineCode, link, image.
 */

import type { Text, Emphasis, Strong, InlineCode, Link, Image, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext, InlineHandlerResult } from '#src/parse/registry';
import type {
    InlineText,
    InlineEmphasis,
    InlineStrong,
    InlineCode as InlineCodeType,
    InlineLink,
    InlineImage,
} from '#src/types/ast.generated';

/**
 * Markdown parser module for inline nodes.
 */
export const InlinesMarkdownParser: MarkdownParserModule = {
    name: 'InlinesMarkdownParser',
    handles: ['text', 'emphasis', 'strong', 'inlineCode', 'link', 'image'],
    order: 10,

    handleInline(node: MdastRootContent, ctx: ParseContext): InlineHandlerResult {
        const sourcePos = ctx.createSourcePos(node);

        // Text
        if (node.type === 'text') {
            const textNode = node as Text;
            const result: InlineText = {
                type: 'text',
                value: textNode.value,
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Emphasis
        if (node.type === 'emphasis') {
            const emphNode = node as Emphasis;
            const result: InlineEmphasis = {
                type: 'emphasis',
                children: ctx.transformInlineChildren(emphNode.children),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Strong
        if (node.type === 'strong') {
            const strongNode = node as Strong;
            const result: InlineStrong = {
                type: 'strong',
                children: ctx.transformInlineChildren(strongNode.children),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Inline code
        if (node.type === 'inlineCode') {
            const codeNode = node as InlineCode;
            const result: InlineCodeType = {
                type: 'inlineCode',
                value: codeNode.value,
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Link
        if (node.type === 'link') {
            const linkNode = node as Link;
            const result: InlineLink = {
                type: 'link',
                url: linkNode.url,
                children: ctx.transformInlineChildren(linkNode.children),
            };
            if (linkNode.title) result.title = linkNode.title;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Image
        if (node.type === 'image') {
            const imgNode = node as Image;
            const result: InlineImage = {
                type: 'image',
                url: imgNode.url,
            };
            if (imgNode.alt) result.alt = imgNode.alt;
            if (imgNode.title) result.title = imgNode.title;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        return null;
    },
};
