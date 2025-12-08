/**
 * Markdown Inline Handlers
 * 
 * Handles inline elements like text, emphasis, strong, code, links, images.
 */

import type { Text, Emphasis, Strong, InlineCode, Link, Image, RootContent } from 'mdast';
import type {
    Inline,
    InlineText,
    InlineEmphasis,
    InlineStrong,
    InlineCode as InlineCodeType,
    InlineLink,
    InlineImage,
} from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext, InlineHandlerResult } from '#src/parse/registry';

/**
 * Handler for text nodes
 */
export const textHandler: MdNodeHandler = {
    nodeTypes: ['text'],

    handleInline(node: RootContent, ctx: MdParseContext): InlineText {
        const textNode = node as Text;
        const sourcePos = ctx.createSourcePos(node);

        const result: InlineText = {
            type: 'text',
            value: textNode.value,
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Handler for emphasis nodes
 */
export const emphasisHandler: MdNodeHandler = {
    nodeTypes: ['emphasis'],

    handleInline(node: RootContent, ctx: MdParseContext): InlineEmphasis {
        const emphNode = node as Emphasis;
        const sourcePos = ctx.createSourcePos(node);

        const result: InlineEmphasis = {
            type: 'emphasis',
            children: ctx.transformInlineChildren(emphNode.children),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Handler for strong nodes
 */
export const strongHandler: MdNodeHandler = {
    nodeTypes: ['strong'],

    handleInline(node: RootContent, ctx: MdParseContext): InlineStrong {
        const strongNode = node as Strong;
        const sourcePos = ctx.createSourcePos(node);

        const result: InlineStrong = {
            type: 'strong',
            children: ctx.transformInlineChildren(strongNode.children),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Handler for inline code nodes
 */
export const inlineCodeHandler: MdNodeHandler = {
    nodeTypes: ['inlineCode'],

    handleInline(node: RootContent, ctx: MdParseContext): InlineCodeType {
        const codeNode = node as InlineCode;
        const sourcePos = ctx.createSourcePos(node);

        const result: InlineCodeType = {
            type: 'inlineCode',
            value: codeNode.value,
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Handler for link nodes
 */
export const linkHandler: MdNodeHandler = {
    nodeTypes: ['link'],

    handleInline(node: RootContent, ctx: MdParseContext): InlineLink {
        const linkNode = node as Link;
        const sourcePos = ctx.createSourcePos(node);

        const result: InlineLink = {
            type: 'link',
            url: linkNode.url,
            children: ctx.transformInlineChildren(linkNode.children),
        };

        if (linkNode.title) result.title = linkNode.title;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Handler for image nodes
 */
export const imageHandler: MdNodeHandler = {
    nodeTypes: ['image'],

    handleInline(node: RootContent, ctx: MdParseContext): InlineImage {
        const imgNode = node as Image;
        const sourcePos = ctx.createSourcePos(node);

        const result: InlineImage = {
            type: 'image',
            url: imgNode.url,
        };

        if (imgNode.alt) result.alt = imgNode.alt;
        if (imgNode.title) result.title = imgNode.title;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * All inline handlers
 */
export const inlineHandlers: MdNodeHandler[] = [
    textHandler,
    emphasisHandler,
    strongHandler,
    inlineCodeHandler,
    linkHandler,
    imageHandler,
];
