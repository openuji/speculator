/**
 * Markdown Unit Parser
 * 
 * Parses markdown content using remark and transforms to Speculator AST
 * using the modular handler registry.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type {  RootContent } from 'mdast';
import type { SourceUnit } from '#src/preprocess/types';
import type { UnitParser } from '#src/parse/types';
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
import { escapeShorthandPipesInTables } from '../utils/markdown-utils.js';

/**
 * Create source position from mdast node position
 */
function createSourcePos(unit: SourceUnit, node: NodeWithPosition): SourcePos {
    if (!node.position) {
        return {
            file: unit.file,
            line: unit.startLine,
            column: 1,
        }
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
        // Escape shorthand pipes in table lines before GFM splits them into cells
        const content = escapeShorthandPipesInTables(unit.content);
        const tree = this.processor.parse(content);

        // Create context for handlers
        const ctx = this.createContext(unit);

        const blocks: (Section | Block)[] = [];

        for (const child of tree.children) {
            const blocksResult = this.transformBlock(child, ctx);
            blocks.push(...blocksResult);
        }

        return blocks;
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
            transformInlineChildren: (children) => self.transformInlineChildren(children as RootContent[], unit),
            transformBlockChildren: (children) => {
                const results: (Section | Block)[] = [];
                const ctx = self.createContext(unit);
                for (const child of children as RootContent[]) {
                    const blocksResult = self.transformBlock(child, ctx);
                    results.push(...blocksResult);
                }
                return results;
            },
            getTextContent: (element) => {
                // Return text content logic (duplicated or imported)
                let text = '';
                for (const child of element.children || []) {
                    if (child.type === 'text') {
                        text += child.value;
                    } else if (child.type === 'element') {
                        text += self.createContext(unit).getTextContent(child);
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
    private transformInline(node: RootContent, unit: SourceUnit): Inline | Inline[] | null {
        const ctx = this.createContext(unit);

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
    private transformInlineChildren(children: RootContent[], unit: SourceUnit): Inline[] {
        const results: Inline[] = [];

        for (const child of children) {
            const result = this.transformInline(child, unit);
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
