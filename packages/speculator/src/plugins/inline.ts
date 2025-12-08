/**
 * Inline Plugin
 * 
 * Handles inline elements: emphasis, strong, code, links, images, text.
 * Also integrates data-cite and xref detection for <a> elements.
 */

import type { Element, RootContent } from 'hast';
import type { Text, Emphasis, Strong, InlineCode, Link, Image, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, InlineHandlerResult } from '#src/pipeline/types';
import type {
    InlineText,
    InlineEmphasis,
    InlineStrong,
    InlineCode as InlineCodeType,
    InlineLink,
    InlineImage,
    InlineCite,
    InlineReference,
} from '#src/types/ast.generated';
import { normalizeTerm, splitLinkTexts, splitForContexts, parseDataCite } from '#src/parse/normalize';

/**
 * Plugin for inline elements.
 */
export const inlinePlugin: Plugin = {
    name: 'inline',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['em', 'i', 'strong', 'b', 'code', 'a', 'img', 'span'],

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

                // Anchor - check for data-cite, xref, or regular link
                if (tagName === 'a') {
                    // Check for data-cite attribute first (hast uses camelCase)
                    const dataCite = ctx.getAttr(element, 'dataCite');
                    if (dataCite) {
                        const parsed = parseDataCite(dataCite);
                        const children = ctx.transformInlineChildren(element.children);

                        const result: InlineCite = {
                            type: 'cite',
                            key: parsed.specId,
                            children,
                        };

                        if (parsed.forcedNormative) {
                            result.forcedNormative = true;
                            result.kind = 'normative';
                        }
                        if (parsed.specId) result.specId = parsed.specId;
                        if (parsed.path) result.path = parsed.path;
                        if (parsed.fragment) result.fragment = parsed.fragment;
                        if (sourcePos) result.sourcePos = sourcePos;

                        return result;
                    }

                    // Check for xref attributes (hast uses camelCase)
                    const href = ctx.getAttr(element, 'href');
                    const hasDataXref = ctx.getAttr(element, 'dataXref') !== undefined ||
                        ctx.getAttr(element, 'dataLt') !== undefined ||
                        ctx.getAttr(element, 'dataXrefFor') !== undefined;

                    if (!href && hasDataXref) {
                        // Treat as cross-reference
                        const rawText = ctx.getTextContent(element);
                        const targetTerm = normalizeTerm(rawText);

                        if (targetTerm) {
                            const dataLt = ctx.getAttr(element, 'dataLt') ?? ctx.getAttr(element, 'dataXref');
                            const candidateTerms = dataLt
                                ? splitLinkTexts(dataLt).map(normalizeTerm)
                                : [targetTerm];

                            const dataXrefFor = ctx.getAttr(element, 'dataXrefFor');
                            const forContexts: (string | null)[] = dataXrefFor
                                ? splitForContexts(dataXrefFor).map(normalizeTerm)
                                : [null];

                            const preferredType = ctx.getAttr(element, 'dataLinkType') ?? null;
                            const xrefSpec = ctx.getAttr(element, 'dataXrefSpec') ?? null;
                            const dataAllowExternal = ctx.getAttr(element, 'dataAllowExternal');
                            const allowExternal = dataAllowExternal !== 'no';

                            const children = ctx.transformInlineChildren(element.children);

                            const result: InlineReference = {
                                type: 'reference',
                                targetTerm,
                                candidateTerms,
                                forContexts,
                                preferredType,
                                xrefSpec,
                                allowExternal,
                                children,
                            };

                            if (sourcePos) result.sourcePos = sourcePos;
                            return result;
                        }
                    }

                    // Regular link
                    const title = ctx.getAttr(element, 'title');
                    const result: InlineLink = {
                        type: 'link',
                        url: href ?? '',
                        children: ctx.transformInlineChildren(element.children),
                    };
                    if (title) result.title = title;
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
        },

        markdown: {
            nodeTypes: ['text', 'emphasis', 'strong', 'inlineCode', 'link', 'image'],

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
        },
    },
};
