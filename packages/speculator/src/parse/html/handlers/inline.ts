/**
 * HTML Inline Handlers
 * 
 * Handles inline elements like em, strong, a, img, etc.
 */

import type { Element, Text as HastText, RootContent } from 'hast';
import type {
    Inline,
    InlineEmphasis,
    InlineStrong,
    InlineCode,
    InlineLink,
    InlineImage,
    InlineText,
} from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext, InlineHandlerResult } from '#src/parse/registry';

/**
 * Handler for emphasis elements (em, i)
 */
export const emphasisHandler: HtmlTagHandler = {
    tags: ['em', 'i'],

    handleInline(element: Element, ctx: HtmlParseContext): InlineEmphasis {
        const sourcePos = ctx.createSourcePos(element);
        const result: InlineEmphasis = {
            type: 'emphasis',
            children: ctx.transformInlineChildren(element.children),
        };
        if (sourcePos) result.sourcePos = sourcePos;
        return result;
    },
};

/**
 * Handler for strong elements (strong, b)
 */
export const strongHandler: HtmlTagHandler = {
    tags: ['strong', 'b'],

    handleInline(element: Element, ctx: HtmlParseContext): InlineStrong {
        const sourcePos = ctx.createSourcePos(element);
        const result: InlineStrong = {
            type: 'strong',
            children: ctx.transformInlineChildren(element.children),
        };
        if (sourcePos) result.sourcePos = sourcePos;
        return result;
    },
};

/**
 * Handler for inline code elements
 */
export const inlineCodeHandler: HtmlTagHandler = {
    tags: ['code'],

    handleInline(element: Element, ctx: HtmlParseContext): InlineCode {
        const sourcePos = ctx.createSourcePos(element);
        const result: InlineCode = {
            type: 'inlineCode',
            value: ctx.getTextContent(element),
        };
        if (sourcePos) result.sourcePos = sourcePos;
        return result;
    },
};

/**
 * Handler for anchor elements
 */
export const linkHandler: HtmlTagHandler = {
    tags: ['a'],

    handleInline(element: Element, ctx: HtmlParseContext): InlineLink {
        const sourcePos = ctx.createSourcePos(element);
        const href = ctx.getAttr(element, 'href') ?? '';
        const title = ctx.getAttr(element, 'title');

        const result: InlineLink = {
            type: 'link',
            url: href,
            children: ctx.transformInlineChildren(element.children),
        };
        if (title) result.title = title;
        if (sourcePos) result.sourcePos = sourcePos;
        return result;
    },
};

/**
 * Handler for image elements
 */
export const imageHandler: HtmlTagHandler = {
    tags: ['img'],

    handleInline(element: Element, ctx: HtmlParseContext): InlineImage {
        const sourcePos = ctx.createSourcePos(element);
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
    },
};

/**
 * Handler for span elements (flattens children)
 */
export const spanHandler: HtmlTagHandler = {
    tags: ['span'],

    handleInline(element: Element, ctx: HtmlParseContext): InlineHandlerResult {
        const children = ctx.transformInlineChildren(element.children);
        return children.length === 1 ? children[0] : children.length > 0 ? children : null;
    },
};

/**
 * All inline handlers
 */
export const inlineHandlers: HtmlTagHandler[] = [
    emphasisHandler,
    strongHandler,
    inlineCodeHandler,
    linkHandler,
    imageHandler,
    spanHandler,
];
