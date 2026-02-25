/**
 * Markdown Unit Parser
 * 
 * Parses markdown content using remark and transforms to Speculator AST
 * using the modular handler registry.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkMdxAgnostic, remarkHeadingAttrBlocks } from './plugins.js';
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
    type ParseContext,
    type NodeWithPosition,
} from '#src/parse/registry';
import { escapeShorthandPipesInTables, normalizeMdxTags } from '../utils/markdown-utils.js';

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

function adjustErrorLineNumbers(error: unknown, startLine: number): void {
    if (!(error instanceof Error) || startLine <= 1) return;

    const startOff = startLine - 1;
    // Match (L:C), (L:C-L:C), or even just L:C if MDX format changes
    const posRegex = /(\(?|)(\d+):(\d+)(?:-(\d+):(\d+))?(\)?|)/g;
    error.message = error.message.replace(posRegex, (_match, openParen = '', l1, c1, l2, c2, closeParen = '') => {
        const nl1 = parseInt(l1) + startOff;
        if (l2 && c2) {
            const nl2 = parseInt(l2) + startOff;
            return `${openParen}${nl1}:${c1}-${nl2}:${c2}${closeParen}`;
        }
        return `${openParen}${nl1}:${c1}${closeParen}`;
    });
}


/**
 * Markdown unit parser implementation using handler registry
 */
export class MarkdownUnitParser implements UnitParser {
    readonly format = 'markdown' as const;

    private processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkMdxAgnostic)
        .use(remarkHeadingAttrBlocks);

    private registry: ParseHandlerRegistry;

    constructor(registry: ParseHandlerRegistry = defaultRegistry) {
        this.registry = registry;
    }

    /**
     * Parse markdown unit to AST blocks
     */
    parse(unit: SourceUnit): (Section | Block)[] {
        let content = unit.content;
        
        // Refined pre-processing for MDX:
        // 1. Escape shorthand pipes in tables (GFM compat)
        content = escapeShorthandPipesInTables(content);
        
        // Parse to mdast tree
        let tree: Root;
        try {
            tree = this.processor.parse(content) as Root;
        } catch (initialError: unknown) {
            // Retry once after normalizing MDX block-like tags. This rescues cases
            // where custom tags begin inline and then cross block boundaries.
            const normalizedContent = normalizeMdxTags(content);
            if (normalizedContent !== content) {
                try {
                    content = normalizedContent;
                    tree = this.processor.parse(content) as Root;
                } catch (normalizedError: unknown) {
                    adjustErrorLineNumbers(normalizedError, unit.startLine);
                    throw normalizedError;
                }
            } else {
                adjustErrorLineNumbers(initialError, unit.startLine);
                throw initialError;
            }
        }
        
        // Run transformers (like remarkHeadingAttrBlocks)
        // We use runSync because our plugins are currently synchronous
        const transformedTree = this.processor.runSync(tree) as Root;

        // Create context for handlers
        const ctx = this.createContext(unit);

        const blocks: (Section | Block)[] = [];

        for (const child of transformedTree.children as RootContent[]) {
            const blocksResult = this.transformBlock(child, ctx);
            blocks.push(...blocksResult);
        }

        return blocks;
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
                for (const child of children as RootContent[]) {
                    const blocksResult = this.transformBlock(child, ctx);
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
                        text += this.createContext(unit).getTextContent(child);
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
            registry: this.registry,
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
