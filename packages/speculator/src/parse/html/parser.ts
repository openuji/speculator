/**
 * HTML Unit Parser
 * 
 * Parses HTML content using rehype and transforms to Speculator AST
 * using the modular handler registry.
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Root, Element, Text as HastText, RootContent } from 'hast';
import type { UnitParser } from '#src/parse/types';
import { SourceMapper } from '#src/parse/source-mapper';
import type { SourceFormat } from '#src/preprocess/types';
import type {
    Section,
    Block,
    Inline,
    BlockParagraph,
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

// No longer need createSourcePos wrapper here, SourceMapper handles it natively


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
     * Parse HTML composed string to AST blocks
     * Overload 1: New API with content string and SourceMapper
     * Overload 2: Legacy API with SourceUnit-like object (backwards compat for tests)
     */
    parse(content: string, sourceMapper: SourceMapper): (Section | Block)[];
    parse(unit: { content: string; file: string; format: string; startLine: number; sideFiles?: Record<string, string> }): (Section | Block)[];
    parse(
        contentOrUnit: string | { content: string; file: string; format: string; startLine: number; sideFiles?: Record<string, string> },
        sourceMapper?: SourceMapper
    ): (Section | Block)[] {
        let content: string;
        if (typeof contentOrUnit === 'string') {
            content = contentOrUnit;
        } else {
            // Legacy SourceUnit-like object
            content = contentOrUnit.content;
            sourceMapper = new SourceMapper(content, {
                fragments: [{
                    startOffset: 0,
                    endOffset: content.length,
                    file: contentOrUnit.file,
                    format: contentOrUnit.format as SourceFormat,
                    originalStartLine: contentOrUnit.startLine,
                    sideFiles: contentOrUnit.sideFiles,
                }]
            });
        }

        if (!sourceMapper) {
            throw new Error('sourceMapper is required in non-legacy mode');
        }
        const tree = this.processor.parse(content) as Root;

        // Create context for handlers
        const ctx = this.createContext(sourceMapper);

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
    private createContext(sourceMapper: SourceMapper): ParseContext {
        return {
            sourceMapper,
            createSourcePos: (node: NodeWithPosition) => (node.position ? sourceMapper.createSourcePos(node.position) : undefined) || { file: 'unknown', line: 1, column: 1 },
            transformInlineChildren: (children) => this.transformInlineChildren(children as RootContent[], sourceMapper),
            transformBlockChildren: (children) => {
                const results: (Section | Block)[] = [];
                const ctx = this.createContext(sourceMapper);
                let currentInlines: RootContent[] = [];

                const flushInlines = () => {
                    if (currentInlines.length > 0) {
                        const inlines = this.transformInlineChildren(currentInlines, sourceMapper);
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
                        const handlers = this.registry.getHtmlBlockHandlers(tagName);
                        const hasHandlers = handlers.length > 0;
                        const shouldTreatAsBlock = hasHandlers || isHtmlBlockTag(tagName);
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

        // Look up handlers in registry
        const handlers = this.registry.getHtmlBlockHandlers(tagName);
        if (handlers.length > 0) {
            for (const handler of handlers) {
                if (handler.handleBlock) {
                    const result = handler.handleBlock(element, ctx);
                    if (result !== null) {
                        if (Array.isArray(result)) return result;
                        return [result];
                    }
                }
            }
            // All tried handlers returned null - don't fall back to generic element
            return [];
        }

        const inlineHandlers = this.registry.getHtmlInlineHandlers(tagName);
        if (inlineHandlers.length > 0) {
            for (const inlineHandler of inlineHandlers) {
                if (inlineHandler.handleInline) {
                    const inlineResult = inlineHandler.handleInline(element, ctx);
                    if (inlineResult !== null) {
                        const sourcePos = ctx.createSourcePos(element);
                        const result: BlockParagraph = {
                            type: 'paragraph',
                            children: Array.isArray(inlineResult) ? inlineResult : [inlineResult],
                        };
                        if (sourcePos) result.sourcePos = sourcePos;
                        return [result];
                    }
                }
            }
            // All tried inline handlers returned null - don't fall back to generic element
            return [];
        }

        const children = ctx.transformBlockChildren(element.children);
        return [createBlockHtmlElement(element, ctx, children)];
    }

    /**
     * Transform hast inline node to Speculator inline(s)
     */
    private transformInline(node: RootContent, sourceMapper: SourceMapper): Inline | Inline[] | null {
        const ctx = this.createContext(sourceMapper);
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

        // Look up handlers in registry
        const handlers = this.registry.getHtmlInlineHandlers(tagName);
        if (handlers.length > 0) {
            for (const handler of handlers) {
                if (handler.handleInline) {
                    const result = handler.handleInline(element, ctx);
                    if (result !== null) {
                        if (Array.isArray(result)) return result.length === 1 ? result[0] : result;
                        return result;
                    }
                }
            }
            // All tried handlers returned null
            return null;
        }

        const children = this.transformInlineChildren(element.children, sourceMapper);
        return createInlineHtmlElement(element, ctx, children);
    }

    /**
     * Transform array of inline children
     */
    private transformInlineChildren(children: RootContent[], sourceMapper: SourceMapper): Inline[] {
        const results: Inline[] = [];

        for (const child of children) {
            const inline = this.transformInline(child, sourceMapper);
            if (inline) {
                if (Array.isArray(inline)) {
                    results.push(...inline);
                } else {
                    results.push(inline);
                }
            }
        }

        return results;
    }
}
