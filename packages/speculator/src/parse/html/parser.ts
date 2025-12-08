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
import type { UnitParser, ParseDiagnostic } from '#src/parse/types';
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
 * Get element attribute value
 */
function getAttr(element: Element, name: string): string | undefined {
    const val = element.properties?.[name];
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' ');
    return undefined;
}

/**
 * Get text content of element recursively
 */
function getTextContent(element: Element): string {
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
 * Parser result including diagnostics
 */
export interface HtmlParseResult {
    blocks: (Section | Block)[];
    diagnostics: ParseDiagnostic[];
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
        return this.parseWithDiagnostics(unit).blocks;
    }

    /**
     * Parse HTML unit to AST blocks with diagnostics
     */
    parseWithDiagnostics(unit: SourceUnit): HtmlParseResult {
        const tree = this.processor.parse(unit.content) as Root;
        const diagnostics: ParseDiagnostic[] = [];

        // Create context for handlers
        const ctx = this.createContext(unit, diagnostics);

        const results: (Section | Block)[] = [];

        for (const child of tree.children) {
            const blocks = this.transformBlock(child, ctx);
            results.push(...blocks);
        }

        return { blocks: results, diagnostics };
    }

    /**
     * Create parse context for handlers
     */
    private createContext(unit: SourceUnit, diagnostics: ParseDiagnostic[]): ParseContext {
        const self = this;

        return {
            unit,
            createSourcePos: (node: NodeWithPosition) => createSourcePos(unit, node),
            transformInlineChildren: (children: RootContent[]) => self.transformInlineChildren(children, unit, diagnostics),
            transformBlockChildren: (children: RootContent[]) => {
                const results: (Section | Block)[] = [];
                const ctx = self.createContext(unit, diagnostics);
                for (const child of children) {
                    results.push(...self.transformBlock(child, ctx));
                }
                return results;
            },
            emitDiagnostic: (diagnostic) => {
                diagnostics.push({ ...diagnostic, file: unit.file });
            },
            getTextContent,
            getAttr,
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

        // Fallback: try to wrap inline content in paragraph
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
    private transformInline(node: RootContent, unit: SourceUnit, diagnostics: ParseDiagnostic[]): Inline | null {
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
        const ctx = this.createContext(unit, diagnostics);

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
    private transformInlineChildren(children: RootContent[], unit: SourceUnit, diagnostics: ParseDiagnostic[]): Inline[] {
        const results: Inline[] = [];

        for (const child of children) {
            if (child.type === 'element') {
                const element = child as Element;
                const tagName = element.tagName.toLowerCase();
                const ctx = this.createContext(unit, diagnostics);
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

            const inline = this.transformInline(child, unit, diagnostics);
            if (inline) {
                results.push(inline);
            }
        }

        return results;
    }
}
