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
import type { UnitParser } from '#src/parse/types';
import { SourceMapper } from '#src/parse/source-mapper';
import type { SourceFormat } from '#src/preprocess/types';
import type {
    Section,
    Block,
    Inline,
} from '#src/types/ast.generated';
import {
    ParseHandlerRegistry,
    defaultRegistry,
    type ParseContext,
    type NodeWithPosition,
} from '#src/parse/registry';
import { escapeShorthandPipesInTables, normalizeMdxTags } from '../utils/markdown-utils.js';

// No longer need createSourcePos wrapper here, SourceMapper handles it natively


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
     * Parse markdown composed string to AST blocks
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
        // Refined pre-processing for MDX:
        // 1. Escape shorthand pipes in tables (GFM compat)
        content = escapeShorthandPipesInTables(content);
        
        // Parse to mdast tree with retry logic for MDX strictness
        let tree: Root = null!;
        let retryCount = 0;
        const maxRetries = 20;
        while (retryCount <= maxRetries) {
            try {
                tree = this.processor.parse(content) as Root;
                break;
            } catch (error: unknown) {
                if (retryCount >= maxRetries) throw error;
                retryCount++;

                const message = error instanceof Error ? error.message : String(error);

                // Strategy 1: Normalize Speculator custom tags (e.g. crossing block boundaries)
                const normalized = normalizeMdxTags(content);
                if (normalized !== content) {
                    content = normalized;
                    continue;
                }

                // Strategy 2: Escape unclosed common HTML tags used as literal text
                // Search for "Expected a closing tag for <tag>" (modern MDX)
                // or similar errors that indicate unclosed tags.
                const tagMatch = message.match(/Expected a closing tag for `<([^>]+)>`/);
                if (tagMatch) {
                    const tagName = tagMatch[1];
                    // Escape all occurrences of this opening tag to &lt;tag
                    // but ONLY if they don't look self-closing or have a close tag.
                    // (Actually, if MDX is complaining, it's safer to just escape them).
                    content = content.replace(new RegExp(`<${tagName}(?![^>]*/>)`, 'g'), `&lt;${tagName}`);
                    continue;
                }

                // Strategy 3: Unclosed block handlers or other JSX errors
                throw error;
            }
        }
        
        // Run transformers (like remarkHeadingAttrBlocks)
        // We use runSync because our plugins are currently synchronous
        const transformedTree = this.processor.runSync(tree) as Root;

        // Create context for handlers
        const ctx = this.createContext(sourceMapper);

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
    private createContext(sourceMapper: SourceMapper): ParseContext {
        return {
            sourceMapper,
            createSourcePos: (node: NodeWithPosition) => {
                if (!node || !node.position) return { file: 'unknown', line: 1, column: 1 };
                return sourceMapper.createSourcePos(node.position) || { file: 'unknown', line: 1, column: 1 };
            },
            transformInlineChildren: (children) => this.transformInlineChildren(children as RootContent[], sourceMapper),
            transformBlockChildren: (children) => {
                const results: (Section | Block)[] = [];
                const ctx = this.createContext(sourceMapper);
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
                        text += this.createContext(sourceMapper).getTextContent(child);
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
    private transformInline(node: RootContent, sourceMapper: SourceMapper): Inline | Inline[] | null {
        const ctx = this.createContext(sourceMapper);

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
    private transformInlineChildren(children: RootContent[], sourceMapper: SourceMapper): Inline[] {
        const results: Inline[] = [];

        for (const child of children) {
            const result = this.transformInline(child, sourceMapper);
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
