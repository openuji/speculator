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

/**
 * Create source position from hast node position
 */
function createSourcePos(unit: SourceUnit, node: NodeWithPosition): SourcePos | undefined {
    if (!node.position) return undefined;

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
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        return {
            unit,
            createSourcePos: (node: NodeWithPosition) => createSourcePos(unit, node),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transformInlineChildren: (children: any[]) => self.transformInlineChildren(children, unit),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transformBlockChildren: (children: any[]) => {
                const results: (Section | Block)[] = [];
                const ctx = self.createContext(unit);
                for (const child of children) {
                    results.push(...self.transformBlock(child, ctx));
                }
                return results;
            },
            getTextContent,
            getAttr,
            registry: self.registry,
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

        // Fallback: try to handle as inline (e.g., <dfn> or <span> at top level)
        const inline = this.transformInline(element, ctx.unit);
        if (inline) {
            const sourcePos = ctx.createSourcePos(element);
            const result: BlockParagraph = {
                type: 'paragraph',
                children: Array.isArray(inline) ? inline : [inline],
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return [result];
        }

        // Deep fallback: wrap children in paragraph
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

        // Fallback: extract text content
        const text = getTextContent(element);
        if (text.trim()) {
            return { type: 'text', value: text };
        }

        return null;
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
