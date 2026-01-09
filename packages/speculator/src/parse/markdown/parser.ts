/**
 * Markdown Unit Parser
 * 
 * Parses markdown content using remark and transforms to Speculator AST
 * using the modular handler registry.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent } from 'mdast';
import type { SourceUnit } from '#src/preprocess/types';
import type { UnitParser, ParseDiagnostic } from '#src/parse/types';
import type {
    Section,
    Block,
    Inline,
    SourcePos,
} from '#src/types/ast.generated';
import {
    ParseHandlerRegistry,
    defaultRegistry,
    type ParseContext,
    type NodeWithPosition,
} from '#src/parse/registry';

/**
 * Create source position from mdast node position
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
 * Parser result including diagnostics
 */
export interface MarkdownParseResult {
    blocks: (Section | Block)[];
    diagnostics: ParseDiagnostic[];
}

/**
 * Markdown unit parser implementation using handler registry
 */
export class MarkdownUnitParser implements UnitParser {
    readonly format = 'markdown' as const;

    private processor = unified().use(remarkParse).use(remarkGfm);
    private registry: ParseHandlerRegistry;

    constructor(registry: ParseHandlerRegistry = defaultRegistry) {
        this.registry = registry;
    }

    /**
     * Parse markdown unit to AST blocks
     */
    parse(unit: SourceUnit): (Section | Block)[] {
        return this.parseWithDiagnostics(unit).blocks;
    }

    /**
     * Parse markdown unit to AST blocks with diagnostics
     */
    parseWithDiagnostics(unit: SourceUnit): MarkdownParseResult {
        const tree = this.processor.parse(unit.content) as Root;
        const diagnostics: ParseDiagnostic[] = [];

        // Create context for handlers
        const ctx = this.createContext(unit, diagnostics);

        const blocks: (Section | Block)[] = [];

        for (const child of tree.children) {
            const blocksResult = this.transformBlock(child, ctx);
            blocks.push(...blocksResult);
        }

        return { blocks, diagnostics };
    }

    /**
     * Create parse context for handlers
     */
    private createContext(unit: SourceUnit, diagnostics: ParseDiagnostic[]): ParseContext {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        return {
            unit,
            createSourcePos: (node: NodeWithPosition) => createSourcePos(unit, node),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transformInlineChildren: (children) => self.transformInlineChildren(children as any, unit, diagnostics),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transformBlockChildren: (children) => {
                const results: (Section | Block)[] = [];
                const ctx = self.createContext(unit, diagnostics);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const child of children as any[]) {
                    const blocksResult = self.transformBlock(child, ctx);
                    results.push(...blocksResult);
                }
                return results;
            },
            emitDiagnostic: (diagnostic) => {
                diagnostics.push({ 
                    ...diagnostic, 
                    file: unit.file,
                    // If sourcePos not provided by handler, we might want to default it?
                    // But usually handlers provide it.
                } as any);
            },
            getTextContent: (element) => {
                // Return text content logic (duplicated or imported)
                let text = '';
                for (const child of element.children) {
                    if (child.type === 'text') {
                        text += (child as any).value;
                    } else if (child.type === 'element') {
                        text += self.createContext(unit, diagnostics).getTextContent(child as any);
                    }
                }
                return text;
            },
            getAttr: (element, name) => {
                const val = element.properties?.[name];
                if (typeof val === 'string') return val;
                if (Array.isArray(val)) return val.join(' ');
                return undefined;
            },
            registry: self.registry,
        };
    }

    /**
     * Transform mdast node to Speculator block(s) or section(s)
     */
    private transformBlock(node: RootContent, ctx: ParseContext): (Section | Block)[] {
        // Look up handlers in registry
        const handlers = this.registry.getMdBlockHandlers(node.type);

        for (const handler of handlers) {
            if (handler.handleBlock) {
                const result = handler.handleBlock(node, ctx);
                if (result !== null) {
                    if (Array.isArray(result)) return result;
                    return [result];
                }
            }
        }

        return [];
    }

    /**
     * Transform mdast inline node to Speculator inline(s)
     */
    private transformInline(node: RootContent, unit: SourceUnit, diagnostics: ParseDiagnostic[]): Inline | Inline[] | null {
        const ctx = this.createContext(unit, diagnostics);

        // Look up handlers in registry
        const handlers = this.registry.getMdInlineHandlers(node.type);

        for (const handler of handlers) {
            if (handler.handleInline) {
                const result = handler.handleInline(node, ctx);
                if (result !== null) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Transform array of inline children
     */
    private transformInlineChildren(children: RootContent[], unit: SourceUnit, diagnostics: ParseDiagnostic[]): Inline[] {
        const results: Inline[] = [];

        for (const child of children) {
            const result = this.transformInline(child, unit, diagnostics);
            if (result === null) continue;

            if (Array.isArray(result)) {
                results.push(...result);
            } else {
                results.push(result);
            }
        }

        return results;
    }
}
