/**
 * HTML Unit Parser
 * 
 * Parses HTML content using rehype and transforms to Speculator AST
 * using the modular handler registry.
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Root, Element, Text as HastText, RootContent } from 'hast';
import type { SourceUnit } from '#src/preprocess/types';
import type { UnitParser } from '#src/parse/types';
import type {
    Section,
    Block,
    Inline,
    BlockParagraph,
    SourcePos,
} from '#src/types/ast.generated';
import {
    ParseHandlerRegistry,
    defaultRegistry,
    type ParseContext,
    type NodeWithPosition,
} from '#src/parse/registry';
import { getAttr, getTextContent } from '#src/parse/utils/hast-utils';
import { isHtmlBlockTag } from '#src/parse/utils/markdown-utils';
import { createBlockHtmlElement, createInlineHtmlElement } from '#src/parse/utils/html-element-utils';

/**
 * Create source position from hast node position
 */
function createSourcePos(unit: SourceUnit, node: NodeWithPosition): SourcePos {
    if (!node.position) {
        return {
            file: unit.file,
            line: unit.startLine,
            column: 1,
        };
    }

    const pos = node.position;
    const result: SourcePos = {
        file: unit.file,
        line: unit.startLine + pos.start.line - 1,
        column: pos.start.column,
    };

    if (pos.start.offset !== undefined) {
        result.offset = pos.start.offset;
    }
    if (pos.end) {
        result.endLine = unit.startLine + pos.end.line - 1;
        result.endColumn = pos.end.column;
        if (pos.end.offset !== undefined) {
            result.endOffset = pos.end.offset;
        }
    }

    return result;
}


/**
 * HTML unit parser implementation using handler registry
 */
export class HtmlUnitParser implements UnitParser {
    readonly format = 'html' as const;

    private processor = unified().use(rehypeParse, { fragment: true });
    private registry: ParseHandlerRegistry;

    constructor(registry: ParseHandlerRegistry = defaultRegistry) {
        this.registry = registry;
    }

    /**
     * Parse HTML unit to AST blocks
     */
    parse(unit: SourceUnit): (Section | Block)[] {
        const tree = this.processor.parse(unit.content) as Root;

        // Create context for handlers
        const ctx = this.createContext(unit);

        const results: (Section | Block)[] = [];

        for (const child of tree.children) {
            const blocks = this.transformBlock(child, ctx);
            results.push(...blocks);
        }

        return results;
    }

    /**
     * Create parse context for handlers
     */
    private createContext(unit: SourceUnit): ParseContext {
        return {
            unit,
            createSourcePos: (node: NodeWithPosition) => createSourcePos(unit, node),
            transformInlineChildren: (children) => this.transformInlineChildren(children as RootContent[], unit),
            transformBlockChildren: (children) => {
                const results: (Section | Block)[] = [];
                const ctx = this.createContext(unit);
                let currentInlines: RootContent[] = [];

                const flushInlines = () => {
                    if (currentInlines.length > 0) {
                        const inlines = this.transformInlineChildren(currentInlines, unit);
                        if (inlines.length > 0) {
                            results.push({
                                type: 'paragraph',
                                children: inlines,
                            } as BlockParagraph);
                        }
                        currentInlines = [];
                    }
                };

                for (const child of children as RootContent[]) {
                    if (child.type === 'element') {
                        const element = child as Element;
                        const tagName = element.tagName.toLowerCase();
                        const handler = this.registry.getHtmlBlockHandler(tagName);
                        const shouldTreatAsBlock = !!handler?.handleBlock || isHtmlBlockTag(tagName);
                        if (shouldTreatAsBlock) {
                            flushInlines();
                            results.push(...this.transformBlock(child, ctx));
                            continue;
                        }
                    }

                    // Text, inline elements, etc. → collect as inlines
                    currentInlines.push(child);
                }

                flushInlines();
                return results;
            },
            getTextContent,
            getAttr,
            registry: this.registry,
        };
    }

    /**
     * Transform hast element to Speculator block(s)
     */
    private transformBlock(node: RootContent, ctx: ParseContext): (Section | Block)[] {
        if (node.type !== 'element') return [];

        const element = node as Element;
        const tagName = element.tagName.toLowerCase();

        // Look up handler in registry
        const handler = this.registry.getHtmlBlockHandler(tagName);

        if (handler?.handleBlock) {
            const result = handler.handleBlock(element, ctx);
            if (result === null) return [];
            if (Array.isArray(result)) return result;
            return [result];
        }

        const inlineHandler = this.registry.getHtmlInlineHandler(tagName);
        if (inlineHandler?.handleInline) {
            const inlineResult = inlineHandler.handleInline(element, ctx);
            if (inlineResult === null) return [];

            const sourcePos = ctx.createSourcePos(element);
            const result: BlockParagraph = {
                type: 'paragraph',
                children: Array.isArray(inlineResult) ? inlineResult : [inlineResult],
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return [result];
        }

        const children = ctx.transformBlockChildren(element.children);
        return [createBlockHtmlElement(element, ctx, children)];
    }

    /**
     * Transform hast inline content to Speculator inline
     */
    private transformInline(node: RootContent, unit: SourceUnit): Inline | null {
        if (node.type === 'text') {
            const textNode = node as HastText;
            // Skip whitespace-only text
            if (!textNode.value.trim()) return null;

            return {
                type: 'text',
                value: textNode.value,
            };
        }

        if (node.type !== 'element') return null;

        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        const ctx = this.createContext(unit);

        // Look up handler in registry
        const handler = this.registry.getHtmlInlineHandler(tagName);

        if (handler?.handleInline) {
            const result = handler.handleInline(element, ctx);
            if (result === null) return null;
            if (Array.isArray(result)) return result.length === 1 ? result[0] : null;
            return result;
        }

        const children = this.transformInlineChildren(element.children, unit);
        return createInlineHtmlElement(element, ctx, children);
    }

    /**
     * Transform array of inline children
     */
    private transformInlineChildren(children: RootContent[], unit: SourceUnit): Inline[] {
        const results: Inline[] = [];

        for (const child of children) {
            if (child.type === 'element') {
                const element = child as Element;
                const tagName = element.tagName.toLowerCase();
                const ctx = this.createContext(unit);
                const handler = this.registry.getHtmlInlineHandler(tagName);

                if (handler?.handleInline) {
                    const result = handler.handleInline(element, ctx);
                    if (result !== null) {
                        if (Array.isArray(result)) {
                            results.push(...result);
                        } else {
                            results.push(result);
                        }
                        continue;
                    }
                }
            }

            const inline = this.transformInline(child, unit);
            if (inline) {
                results.push(inline);
            }
        }

        return results;
    }
}
