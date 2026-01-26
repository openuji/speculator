/**
 * Inlines HTML Parser
 *
 * Handles inline HTML elements: em, i, strong, b, code, var, img, span.
 * Note: <a> elements are handled by ReferenceHtmlParser.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, InlineHandlerResult } from '#src/parse/registry';
import type {
    InlineEmphasis,
    InlineStrong,
    InlineCode as InlineCodeType,
    InlineVariable,
    InlineImage,
} from '#src/types/ast.generated';

/**
 * HTML parser module for inline elements.
 */
export const InlinesHtmlParser: HtmlParserModule = {
    name: 'InlinesHtmlParser',
    handles: ['em', 'i', 'strong', 'b', 'code', 'var', 'img', 'span'],
    order: 10,

    handleInline(element: Element, ctx: ParseContext): InlineHandlerResult {
        const tagName = element.tagName.toLowerCase();
        const sourcePos = ctx.createSourcePos(element);

        // Emphasis (em, i)
        if (tagName === 'em' || tagName === 'i') {
            const result: InlineEmphasis = {
                type: 'emphasis',
                children: ctx.transformInlineChildren(element.children),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Strong (strong, b)
        if (tagName === 'strong' || tagName === 'b') {
            const result: InlineStrong = {
                type: 'strong',
                children: ctx.transformInlineChildren(element.children),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Inline code
        if (tagName === 'code') {
            const result: InlineCodeType = {
                type: 'inlineCode',
                value: ctx.getTextContent(element),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Variables
        if (tagName === 'var') {
            const result: InlineVariable = {
                type: 'variable',
                value: ctx.getTextContent(element),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Image
        if (tagName === 'img') {
            const src = ctx.getAttr(element, 'src') ?? '';
            const alt = ctx.getAttr(element, 'alt');
            const title = ctx.getAttr(element, 'title');
            const result: InlineImage = {
                type: 'image',
                url: src,
            };
            if (alt) result.alt = alt;
            if (title) result.title = title;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Span - flatten children
        if (tagName === 'span') {
            const children = ctx.transformInlineChildren(element.children);
            return children.length === 1 ? children[0] : children.length > 0 ? children : null;
        }

        return null;
    },
};
