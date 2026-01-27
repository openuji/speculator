/**
 * Shared HAST Utilities
 * 
 * Common utility functions for working with hast (HTML AST) nodes,
 * shared between HTML parsers and markdown HTML inline handling.
 */

import type { Element, Text as HastText, RootContent as HastRootContent } from 'hast';
import type { Text } from 'mdast';
import type { ParseContext, NodeWithPosition } from '#src/parse/registry';
import type { Inline, SourcePos } from '#src/types/ast.generated';

/**
 * Get element attribute value from hast element.
 * Handles various types: strings, arrays (joins with space), numbers, and booleans.
 */
export function getAttr(element: Element, name: string): string | undefined {
    let val = element.properties?.[name];

    // Fallback: if camelCase name not found, try kebab-case for data- attributes
    if (val === undefined && name.startsWith('data')) {
        const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        val = element.properties?.[kebab];
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

/**
 * Transform a hast node to Speculator inline(s) using HTML handlers.
 * This is the core transformation logic shared by both paragraph and block HTML parsers.
 */
export function transformHastInline(node: HastRootContent, ctx: ParseContext): Inline | Inline[] | null {
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
