/**
 * Shared HAST Utilities
 * 
 * Common utility functions for working with hast (HTML AST) nodes,
 * shared between HTML parsers and markdown HTML inline handling.
 */

import type { Element, Text as HastText, RootContent as HastRootContent } from 'hast';
import type { Text } from 'mdast';
import type { ParseContext, NodeWithPosition } from '#src/parse/registry';
import type { Inline, SourcePos, Block, Section, BlockParagraph } from '#src/types/ast.generated';

/**
 * Get element attribute value from hast element.
 * Handles various types: strings, arrays (joins with space), numbers, and booleans.
 */
export function getAttr(element: Element, name: string): string | undefined {
    let val = element.properties?.[name];

    // Fallback: handle data- attributes (check both camelCase and kebab-case)
    if (val === undefined && name.startsWith('data')) {
        const camel = name.replace(/-([a-z0-9])/g, (g) => g[1].toUpperCase());
        const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        val = element.properties?.[camel] ?? element.properties?.[kebab];
    }

    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' ');
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean' && val) return name;
    return undefined;
}

/**
 * Get text content of element recursively.
 * Extracts all text from nested elements.
 */
export function getTextContent(element: Element): string {
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

import { parseMarkdownInlines } from './markdown-utils.js';

/**
 * Transform a hast node to Speculator inline(s) using HTML handlers.
 * This is the core transformation logic shared by both paragraph and block HTML parsers.
 */
export function transformHastInline(node: HastRootContent, ctx: ParseContext): Inline | Inline[] | null {
    if (node.type === 'text') {
        const textValue = (node as HastText).value;
        // Delegate back to registry's transformInlineChildren. 
        // In a hastCtx, this will be handled by our recursive-safe wrapper.
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
 * Transform a hast node to Speculator block(s) using HTML handlers.
 */
export function transformHastBlock(node: HastRootContent, ctx: ParseContext): (Section | Block)[] {
    if (node.type !== 'element') return [];

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    const handler = ctx.registry.getHtmlBlockHandler(tagName);

    if (handler?.handleBlock) {
        const result = handler.handleBlock(element, ctx);
        if (result === null) return [];
        if (Array.isArray(result)) return result;
        return [result];
    }

    // Fallback: wrap as paragraph if it has inline content
    const sourcePos = ctx.createSourcePos(element);
    const inlines = ctx.transformInlineChildren(element.children);
    if (inlines.length > 0) {
        const result: BlockParagraph = {
            type: 'paragraph',
            children: inlines,
        };
        if (sourcePos) result.sourcePos = sourcePos;
        return [result];
    }

    return [];
}

/**
 * Create a hast-aware ParseContext from a base (markdown) context.
 * This allows hast nodes to be transformed using the same handler infrastructure.
 * 
 * If parentSourcePos is provided, it will be used as the base for all child nodes
 * created from the hast tree (correcting offsets for HTML inside Markdown).
 */
export function createHastContext(ctx: ParseContext, parentSourcePos?: SourcePos): ParseContext {
    const originalTransform = ctx.transformInlineChildren;
    
    // Create an overridden createSourcePos if we have a parent offset
    const createSourcePos = parentSourcePos 
        ? (hastNode: NodeWithPosition) => {
            const localPos = hastNode.position;
            if (!localPos) return parentSourcePos;
            
            return {
                ...parentSourcePos,
                line: parentSourcePos.line + localPos.start.line - 1,
                // Column is only relative if on the first line of the fragment
                column: localPos.start.line === 1 
                    ? parentSourcePos.column + localPos.start.column - 1 
                    : localPos.start.column,
                offset: parentSourcePos.offset !== undefined 
                    ? parentSourcePos.offset + (localPos.start.offset || 0) 
                    : undefined
            };
        }
        : ctx.createSourcePos;

    const hastCtx: ParseContext = {
        ...ctx,
        createSourcePos,
        transformInlineChildren: (children) => {
            const results: Inline[] = [];
            for (const child of children as HastRootContent[]) {
                if (child.type === 'text') {
                    // Re-parse text as Markdown to handle core markup (**bold**, `code`) and shorthands.
                    // We use originalTransform (the non-recursive one) to break the chain.
                    const mdastNodes = parseMarkdownInlines((child as HastText).value);
                    results.push(...originalTransform(mdastNodes));
                } else if (child.type === 'element') {
                    const res = transformHastInline(child, hastCtx);
                    if (res) {
                        if (Array.isArray(res)) results.push(...res);
                        else results.push(res);
                    }
                } else {
                    // Fallback for any other nodes (e.g. already parsed mdast nodes)
                    results.push(...originalTransform([child]));
                }
            }
            return results;
        },
        transformBlockChildren: (children) => {
            const results: (Section | Block)[] = [];
            let currentInlines: HastRootContent[] = [];

            const flushInlines = () => {
                if (currentInlines.length > 0) {
                    const inlines = hastCtx.transformInlineChildren(currentInlines);
                    if (inlines.length > 0) {
                        results.push({
                            type: 'paragraph',
                            children: inlines,
                        } as BlockParagraph);
                    }
                    currentInlines = [];
                }
            };

            for (const child of children as HastRootContent[]) {
                if (child.type === 'element') {
                    const element = child as Element;
                    const handler = hastCtx.registry.getHtmlBlockHandler(element.tagName.toLowerCase());
                    if (handler?.handleBlock) {
                        flushInlines();
                        results.push(...transformHastBlock(child, hastCtx));
                        continue;
                    }
                }
                // If not a block element, add to current inlines
                currentInlines.push(child);
            }
            flushInlines();
            return results;
        },
        getTextContent,
        getAttr,
    };
    return hastCtx;
}
