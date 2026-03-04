/**
 * MDX Markdown Parser
 *
 * Handles mdast MDX JSX nodes and delegates by tag name to HTML handlers.
 * This lets tags like <dfn>, <a>, <aside>, <spec-statement>, etc. share
 * the same parsing logic across HTML and Markdown inputs.
 */

import type { Element } from 'hast';
import type { Paragraph, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext, BlockHandlerResult, InlineHandlerResult } from '#src/parse/registry';
import type {
    Block,
    BlockParagraph,
    Inline,
    Section,
} from '#src/types/ast.generated';
import { isHtmlBlockTag } from '#src/parse/utils/markdown-utils';
import { createBlockHtmlElement, createInlineHtmlElement } from '#src/parse/utils/html-element-utils';

type MdxJsxNode = MdastRootContent & {
    type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
    name?: string | null;
    attributes?: Array<{
        type?: string;
        name?: string;
        value?: unknown;
    }>;
    children?: MdastRootContent[];
};

type MdxTextExpressionNode = MdastRootContent & {
    type: 'mdxTextExpression';
    value?: unknown;
};

type MdxVirtualElement = Element & {
    __mdxSource?: MdxJsxNode;
};

type HastPropertyValue = string | number | boolean | Array<string | number> | null | undefined;

function isMdxJsxNode(node: MdastRootContent | null | undefined): node is MdxJsxNode {
    return node?.type === 'mdxJsxFlowElement' || node?.type === 'mdxJsxTextElement';
}

function isMdxTextExpression(node: MdastRootContent | null | undefined): node is MdxTextExpressionNode {
    return node?.type === 'mdxTextExpression';
}

function toCamelCase(name: string): string {
    return name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function toKebabCase(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function normalizeAttrValue(attrValue: unknown): HastPropertyValue {
    if (attrValue === null || attrValue === undefined) return true;
    if (typeof attrValue === 'string' || typeof attrValue === 'number' || typeof attrValue === 'boolean') {
        return attrValue;
    }
    return undefined;
}

function setAttrAliases(properties: Record<string, HastPropertyValue>, name: string, value: HastPropertyValue): void {
    properties[name] = value;

    const camelName = toCamelCase(name);
    if (camelName !== name) properties[camelName] = value;

    const kebabName = toKebabCase(name);
    if (kebabName !== name) properties[kebabName] = value;

    if (name === 'class') properties.className = value;
    if (name === 'className') properties.class = value;
}

function toMdxProperties(node: MdxJsxNode): Record<string, HastPropertyValue> {
    const properties: Record<string, HastPropertyValue> = {};

    for (const attr of node.attributes ?? []) {
        if (!attr || attr.type === 'mdxJsxExpressionAttribute') continue;
        if (typeof attr.name !== 'string' || attr.name.length === 0) continue;

        const attrValue = normalizeAttrValue(attr.value);
        if (attrValue === undefined) continue;

        setAttrAliases(properties, attr.name, attrValue);
    }

    return properties;
}

function toMdxVirtualElement(node: MdxJsxNode, mode: 'block' | 'inline'): MdxVirtualElement {
    const mdxChildren = node.children ?? [];

    const childrenForMode: MdastRootContent[] = mode === 'block' && node.type === 'mdxJsxTextElement'
        ? [{
            type: 'paragraph',
            children: mdxChildren as unknown as Paragraph['children'],
            position: node.position,
        } as unknown as MdastRootContent]
        : mdxChildren;

    return {
        type: 'element',
        tagName: node.name ?? '',
        properties: toMdxProperties(node),
        children: childrenForMode as unknown as Element['children'],
        position: node.position as Element['position'],
        __mdxSource: node,
    };
}

function isMdxVirtualElement(element: Element): element is MdxVirtualElement {
    return '__mdxSource' in element;
}

function attrValueToString(value: unknown, attrName: string): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map((part) => String(part)).join(' ');
    if (typeof value === 'boolean' && value) return attrName;
    return undefined;
}

function getMdxAttr(element: MdxVirtualElement, name: string): string | undefined {
    const properties = element.properties as Record<string, unknown> | undefined;
    if (!properties) return undefined;

    const candidates = [name, toCamelCase(name), toKebabCase(name)];
    for (const candidate of candidates) {
        const normalized = attrValueToString(properties[candidate], name);
        if (normalized !== undefined) return normalized;
    }

    return undefined;
}

function collectMdxText(node: unknown): string {
    if (Array.isArray(node)) {
        return node.map(collectMdxText).join('');
    }

    if (!node || typeof node !== 'object') return '';

    const candidate = node as { type?: string; value?: unknown; children?: unknown[] };

    if ((candidate.type === 'text' || candidate.type === 'inlineCode' || candidate.type === 'code')
        && typeof candidate.value === 'string') {
        return candidate.value;
    }

    if ((candidate.type === 'mdxTextExpression' || candidate.type === 'mdxFlowExpression')
        && typeof candidate.value === 'string') {
        return `{${candidate.value}}`;
    }

    if (Array.isArray(candidate.children)) {
        return candidate.children.map(collectMdxText).join('');
    }

    return '';
}

function createMdxContext(ctx: ParseContext): ParseContext {
    return {
        ...ctx,
        transformInlineChildren: (children) => {
            const flattened: MdastRootContent[] = [];
            for (const child of children as MdastRootContent[]) {
                if (
                    child
                    && typeof child === 'object'
                    && child.type === 'paragraph'
                    && Array.isArray((child as Paragraph).children)
                ) {
                    flattened.push(...((child as Paragraph).children as unknown as MdastRootContent[]));
                    continue;
                }
                flattened.push(child);
            }
            return ctx.transformInlineChildren(flattened);
        },
        getAttr: (element, name) => {
            if (isMdxVirtualElement(element)) {
                const value = getMdxAttr(element, name);
                if (value !== undefined) return value;
            }
            return ctx.getAttr(element, name);
        },
        getTextContent: (element) => {
            if (isMdxVirtualElement(element)) {
                return collectMdxText(element.children);
            }
            return ctx.getTextContent(element);
        },
    };
}

function inlineResultToParagraph(result: InlineHandlerResult, sourcePos: ReturnType<ParseContext['createSourcePos']>): BlockParagraph | null {
    if (result === null) return null;

    const inlines: Inline[] = Array.isArray(result) ? result : [result];
    if (inlines.length === 0) return null;

    const paragraph: BlockParagraph = {
        type: 'paragraph',
        children: inlines,
    };
    if (sourcePos) paragraph.sourcePos = sourcePos;
    return paragraph;
}

function appendBlockResult(target: (Section | Block)[], result: BlockHandlerResult): void {
    if (result === null) return;
    if (Array.isArray(result)) {
        target.push(...result);
        return;
    }
    target.push(result);
}

function isBlockLikeMdxTag(node: MdxJsxNode, ctx: ParseContext): boolean {
    const tagName = (node.name ?? '').toLowerCase();
    if (!tagName) return false;
    if (ctx.registry.getHtmlBlockHandlers(tagName).some(h => h.handleBlock)) return true;
    if (isHtmlBlockTag(tagName)) return true;
    if (tagName.includes('-')) return true;
    return false;
}

function fallbackBlockFromChildren(node: MdxJsxNode, ctx: ParseContext): BlockHandlerResult {
    if (node.name) {
        const virtualElement = toMdxVirtualElement(node, 'block');
        let children = ctx.transformBlockChildren(node.children ?? []);

        if (children.length === 0) {
            const inlines = ctx.transformInlineChildren(node.children ?? []);
            if (inlines.length > 0) {
                const paragraph: BlockParagraph = {
                    type: 'paragraph',
                    children: inlines,
                };
                const sourcePos = ctx.createSourcePos(node);
                if (sourcePos) paragraph.sourcePos = sourcePos;
                children = [paragraph];
            }
        }

        return createBlockHtmlElement(virtualElement, ctx, children);
    }

    const blocks = ctx.transformBlockChildren(node.children ?? []);
    if (blocks.length > 0) return blocks;

    const inlines = ctx.transformInlineChildren(node.children ?? []);
    if (inlines.length === 0) return null;

    const paragraph: BlockParagraph = {
        type: 'paragraph',
        children: inlines,
    };

    const sourcePos = ctx.createSourcePos(node);
    if (sourcePos) paragraph.sourcePos = sourcePos;

    return paragraph;
}

function fallbackInlineFromChildren(node: MdxJsxNode, ctx: ParseContext): InlineHandlerResult {
    if (node.name) {
        const virtualElement = toMdxVirtualElement(node, 'inline');
        return createInlineHtmlElement(
            virtualElement,
            ctx,
            ctx.transformInlineChildren(node.children ?? []),
        );
    }

    const inlines = ctx.transformInlineChildren(node.children ?? []);
    if (inlines.length === 0) return null;
    return inlines.length === 1 ? inlines[0] : inlines;
}

function handleMdxBlock(node: MdxJsxNode, ctx: ParseContext): BlockHandlerResult {
    const tagName = (node.name ?? '').toLowerCase();
    if (!tagName) return fallbackBlockFromChildren(node, ctx);

    const wrapperCtx = createMdxContext(ctx);
    const handlers = ctx.registry.getHtmlBlockHandlers(tagName);
    for (const handler of handlers) {
        if (handler.handleBlock) {
            const result = handler.handleBlock(toMdxVirtualElement(node, 'block'), wrapperCtx);
            if (result !== null) return result;
        }
    }

    const inlineHandlers = ctx.registry.getHtmlInlineHandlers(tagName);
    for (const inlineHandler of inlineHandlers) {
        if (inlineHandler.handleInline) {
            const inlineResult = inlineHandler.handleInline(toMdxVirtualElement(node, 'inline'), wrapperCtx);
            if (inlineResult !== null) {
                return inlineResultToParagraph(inlineResult, ctx.createSourcePos(node));
            }
        }
    }

    // If handlers existed but all returned null, don't fall back to children
    if (handlers.length > 0 || inlineHandlers.length > 0) {
        return [];
    }

    return fallbackBlockFromChildren(node, ctx);
}

function handleMdxInline(node: MdxJsxNode, ctx: ParseContext): InlineHandlerResult {
    const tagName = (node.name ?? '').toLowerCase();
    if (!tagName) return fallbackInlineFromChildren(node, ctx);

    const wrapperCtx = createMdxContext(ctx);
    const handlers = ctx.registry.getHtmlInlineHandlers(tagName);
    if (handlers.length > 0) {
        for (const handler of handlers) {
            if (handler.handleInline) {
                const result = handler.handleInline(toMdxVirtualElement(node, 'inline'), wrapperCtx);
                if (result !== null) return result;
            }
        }
        // All tried handlers returned null
        return null;
    }

    return fallbackInlineFromChildren(node, ctx);
}

function handleMdxExpressionInline(node: MdxTextExpressionNode, ctx: ParseContext): InlineHandlerResult {
    const rawValue = typeof node.value === 'string' ? node.value : '';
    if (!rawValue) return null;

    // Recreate original source text so shorthand parser can still detect patterns
    // like {{Interface}} that MDX tokenizes as mdxTextExpression.
    const syntheticText = {
        type: 'text',
        value: `{${rawValue}}`,
        position: node.position,
    } as MdastRootContent;

    const inlines = ctx.transformInlineChildren([syntheticText]);
    if (inlines.length === 0) return null;
    return inlines.length === 1 ? inlines[0] : inlines;
}

/**
 * Markdown parser module for MDX nodes.
 */
export const MdxMarkdownParser: MarkdownParserModule = {
    name: 'MdxMarkdownParser',
    handles: ['mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxTextExpression', 'paragraph'],
    order: 5,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHandlerResult {
        // When a single MDX tag sits inside a paragraph, allow block handlers
        // (e.g. <spec-statement>) to claim it before Paragraph parser runs.
        if (node.type === 'paragraph') {
            const paragraph = node as Paragraph;
            if (paragraph.children.length === 1) {
                const onlyChild = paragraph.children[0] as MdastRootContent;
                if (!isMdxJsxNode(onlyChild)) return null;

                const tagName = (onlyChild.name ?? '').toLowerCase();
                if (!tagName) return null;
                const handlers = ctx.registry.getHtmlBlockHandlers(tagName);
                const hasBlockHandler = handlers.some(h => h.handleBlock);
                if (!hasBlockHandler && !isHtmlBlockTag(tagName) && !tagName.includes('-')) return null;

                return handleMdxBlock(onlyChild, ctx);
            }

            const blocks: (Section | Block)[] = [];
            let sawBlockLikeTag = false;
            for (const child of paragraph.children as MdastRootContent[]) {
                if (isMdxJsxNode(child) && isBlockLikeMdxTag(child, ctx)) {
                    sawBlockLikeTag = true;
                    appendBlockResult(blocks, handleMdxBlock(child, ctx));
                    continue;
                }

                if (child.type === 'text' && child.value.trim().length === 0) {
                    continue;
                }

                // Mixed content paragraph (normal inline text + MDX tags): let
                // ParagraphsMarkdownParser handle this as an inline paragraph.
                return null;
            }

            return sawBlockLikeTag ? blocks : null;
        }

        if (!isMdxJsxNode(node)) return null;
        return handleMdxBlock(node, ctx);
    },

    handleInline(node: MdastRootContent, ctx: ParseContext): InlineHandlerResult {
        if (isMdxTextExpression(node)) {
            return handleMdxExpressionInline(node, ctx);
        }

        if (!isMdxJsxNode(node)) return null;
        return handleMdxInline(node, ctx);
    },
};
