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
    type MdParseContext,
    type NodeWithPosition,
} from '#src/parse/registry';
import { registerDefaultMdHandlers } from '#src/parse/markdown/handlers/index';

// Register default handlers on import
registerDefaultMdHandlers(defaultRegistry);

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
        const tree = this.processor.parse(unit.content) as Root;

        // Create context for handlers
        const ctx = this.createContext(unit);

        const blocks: Block[] = [];

        for (const child of tree.children) {
            const block = this.transformBlock(child, ctx);
            if (block) {
                blocks.push(block);
            }
        }

        return blocks;
    }

    /**
     * Create parse context for handlers
     */
    private createContext(unit: SourceUnit): MdParseContext {
        const self = this;

        return {
            unit,
            createSourcePos: (node: NodeWithPosition) => createSourcePos(unit, node),
            transformInlineChildren: (children: RootContent[]) => self.transformInlineChildren(children, unit),
            transformBlockChildren: (children: RootContent[]) => {
                const results: Block[] = [];
                const ctx = self.createContext(unit);
                for (const child of children) {
                    const block = self.transformBlock(child, ctx);
                    if (block) {
                        results.push(block);
                    }
                }
                return results;
            },
        };
    }

    /**
     * Transform mdast node to Speculator block
     */
    private transformBlock(node: RootContent, ctx: MdParseContext): Block | null {
        // Look up handler in registry
        const handler = this.registry.getMdBlockHandler(node.type);

        if (handler?.handleBlock) {
            return handler.handleBlock(node, ctx);
        }

        return null;
    }

    /**
     * Transform mdast inline node to Speculator inline
     */
    private transformInline(node: RootContent, unit: SourceUnit): Inline | null {
        const ctx = this.createContext(unit);

        // Look up handler in registry
        const handler = this.registry.getMdInlineHandler(node.type);

        if (handler?.handleInline) {
            const result = handler.handleInline(node, ctx);
            if (result === null) return null;
            if (Array.isArray(result)) return result.length === 1 ? result[0] : null;
            return result;
        }

        return null;
    }

    /**
     * Transform array of inline children
     */
    private transformInlineChildren(children: RootContent[], unit: SourceUnit): Inline[] {
        return children
            .map(child => this.transformInline(child, unit))
            .filter((n): n is Inline => n !== null);
    }
}
