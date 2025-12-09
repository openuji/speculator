/**
 * Parse Handler Registry
 * 
 * Provides a modular architecture for parser modules.
 * Parser modules handle specific hast/mdast nodes and emit SpecAST nodes.
 */

import type { Element, RootContent } from 'hast';
import type { RootContent as MdastRootContent } from 'mdast';
import type { SourceUnit } from '#src/preprocess/types';
import type { Section, Block, Inline, SourcePos } from '#src/types/ast.generated';
import type { ParseDiagnostic } from '#src/parse/types';

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Node with optional position information
 */
export interface NodeWithPosition {
    position?: {
        start: { line: number; column: number; offset?: number };
        end?: { line: number; column: number; offset?: number };
    };
}

/**
 * Result of handling a node - can emit blocks, inlines, or null
 */
export type HandlerResult = Section | Block | Inline | (Section | Block)[] | Inline[] | null;

/**
 * Block-level handler result
 */
export type BlockHandlerResult = Section | Block | (Section | Block)[] | null;

/**
 * Inline-level handler result
 */
export type InlineHandlerResult = Inline | Inline[] | null;

// ============================================================================
// Unified Parse Context
// ============================================================================

/**
 * Unified context provided to parser modules
 * 
 * This is the common interface for both HTML and Markdown parser modules.
 * Some methods may be no-ops depending on the format.
 */
export interface ParseContext {
    /** Source unit being parsed */
    readonly unit: SourceUnit;

    /** Create source position from node */
    createSourcePos(node: NodeWithPosition): SourcePos | undefined;

    /** Transform children to inline nodes */
    transformInlineChildren(children: RootContent[] | MdastRootContent[]): Inline[];

    /** Transform children to block nodes (recursive) */
    transformBlockChildren(children: RootContent[] | MdastRootContent[]): (Section | Block)[];

    /** 
     * Emit a diagnostic from the parser module.
     * Use for warnings about invalid structure, unsupported elements, etc.
     */
    emitDiagnostic(diagnostic: Omit<ParseDiagnostic, 'file'>): void;

    /** Get text content of element (HTML) */
    getTextContent(element: Element): string;

    /** Get attribute value (HTML) */
    getAttr(element: Element, name: string): string | undefined;
}

// ============================================================================
// Parser Module Interfaces (per AGENTS.md)
// ============================================================================

/**
 * HTML parser module for handling hast elements.
 * 
 * Parser modules are first-class modules that live in src/parse/.
 * They handle specific HTML tags and emit SpecAST nodes.
 */
export interface HtmlParserModule {
    /** Unique parser module name */
    name: string;

    /** Tag names this parser handles (e.g., ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) */
    handles: string[];

    /** 
     * Order for deterministic dispatch. 
     * Lower numbers run first. Default is 10.
     */
    order?: number;

    /** Handle a block-level element */
    handleBlock?(element: Element, ctx: ParseContext): BlockHandlerResult;

    /** Handle an inline-level element */
    handleInline?(element: Element, ctx: ParseContext): InlineHandlerResult;
}

/**
 * Markdown parser module for handling mdast nodes.
 * 
 * Parser modules are first-class modules that live in src/parse/.
 * They handle specific mdast node types and emit SpecAST nodes.
 */
export interface MarkdownParserModule {
    /** Unique parser module name */
    name: string;

    /** Node types this parser handles (e.g., ['heading']) */
    handles: string[];

    /** 
     * Order for deterministic dispatch. 
     * Lower numbers run first. Default is 10.
     */
    order?: number;

    /** Handle a block-level node */
    handleBlock?(node: MdastRootContent, ctx: ParseContext): Block | null;

    /** Handle an inline-level node */
    handleInline?(node: MdastRootContent, ctx: ParseContext): InlineHandlerResult;
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Registry for parser modules
 * 
 * Manages parser modules for HTML tags and Markdown node types.
 * Supports ordering for deterministic dispatch.
 */
export class ParseHandlerRegistry {
    private htmlBlockHandlers = new Map<string, HtmlParserModule>();
    private htmlInlineHandlers = new Map<string, HtmlParserModule>();
    private mdBlockHandlers = new Map<string, MarkdownParserModule>();
    private mdInlineHandlers = new Map<string, MarkdownParserModule>();

    /**
     * Register an HTML parser module
     */
    registerHtmlParser(parser: HtmlParserModule): void {
        for (const tag of parser.handles) {
            const normalizedTag = tag.toLowerCase();
            // Check if we should override based on order
            if (parser.handleBlock) {
                const existing = this.htmlBlockHandlers.get(normalizedTag);
                if (!existing || (parser.order ?? 10) < (existing.order ?? 10)) {
                    this.htmlBlockHandlers.set(normalizedTag, parser);
                }
            }
            if (parser.handleInline) {
                const existing = this.htmlInlineHandlers.get(normalizedTag);
                if (!existing || (parser.order ?? 10) < (existing.order ?? 10)) {
                    this.htmlInlineHandlers.set(normalizedTag, parser);
                }
            }
        }
    }

    /**
     * Register a Markdown parser module
     */
    registerMarkdownParser(parser: MarkdownParserModule): void {
        for (const nodeType of parser.handles) {
            // Check if we should override based on order
            if (parser.handleBlock) {
                const existing = this.mdBlockHandlers.get(nodeType);
                if (!existing || (parser.order ?? 10) < (existing.order ?? 10)) {
                    this.mdBlockHandlers.set(nodeType, parser);
                }
            }
            if (parser.handleInline) {
                const existing = this.mdInlineHandlers.get(nodeType);
                if (!existing || (parser.order ?? 10) < (existing.order ?? 10)) {
                    this.mdInlineHandlers.set(nodeType, parser);
                }
            }
        }
    }

    /**
     * Get HTML block parser for a tag
     */
    getHtmlBlockHandler(tagName: string): HtmlParserModule | undefined {
        return this.htmlBlockHandlers.get(tagName.toLowerCase());
    }

    /**
     * Get HTML inline parser for a tag
     */
    getHtmlInlineHandler(tagName: string): HtmlParserModule | undefined {
        return this.htmlInlineHandlers.get(tagName.toLowerCase());
    }

    /**
     * Get Markdown block parser for a node type
     */
    getMdBlockHandler(nodeType: string): MarkdownParserModule | undefined {
        return this.mdBlockHandlers.get(nodeType);
    }

    /**
     * Get Markdown inline parser for a node type
     */
    getMdInlineHandler(nodeType: string): MarkdownParserModule | undefined {
        return this.mdInlineHandlers.get(nodeType);
    }

    /**
     * Check if a handler exists for HTML tag
     */
    hasHtmlHandler(tagName: string): boolean {
        const normalized = tagName.toLowerCase();
        return this.htmlBlockHandlers.has(normalized) || this.htmlInlineHandlers.has(normalized);
    }

    /**
     * Check if a handler exists for Markdown node type
     */
    hasMdHandler(nodeType: string): boolean {
        return this.mdBlockHandlers.has(nodeType) || this.mdInlineHandlers.has(nodeType);
    }
}

/**
 * Global default registry instance
 */
export const defaultRegistry = new ParseHandlerRegistry();
