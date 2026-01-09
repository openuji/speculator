/**
 * Parse Handler Registry
 * 
 * Manages the registration and lookup of HTML and Markdown parser modules.
 */

import type { Element } from 'hast';
import type { RootContent as MdastRootContent } from 'mdast';
import type { Block, Inline, Section } from '#src/types/ast.generated';
import type { SourceUnit } from '#src/preprocess/types';

// ============================================================================
// Types & Interfaces
// ============================================================================


/** Node with position info from standard parsers */
export interface NodeWithPosition {
    position?: {
        start: { line: number; column: number; offset?: number };
        end: { line: number; column: number; offset?: number };
    };
}

/** Result of a block-level parse handler */
export type BlockHandlerResult = Block | Section | (Block | Section)[] | null;

/** Result of an inline-level parse handler */
export type InlineHandlerResult = Inline | Inline[] | null;

/** Generic result type for either block or inline handler */
export type HandlerResult = BlockHandlerResult | InlineHandlerResult;

/**
 * Context provided to parser modules during transformation.
 */
export interface ParseContext {
    /** The source unit being parsed */
    readonly unit: SourceUnit;

    /** Create a source position for the AST node */
    createSourcePos(node: NodeWithPosition): any;

    /** Transform an array of mdast/hast inline children */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformInlineChildren(children: any[]): Inline[];

    /** Transform an array of mdast/hast block children */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformBlockChildren(children: any[]): (Section | Block)[];

    /** Get text content of element (HTML) */
    getTextContent(element: Element): string;

    /** Get attribute value (HTML) */
    getAttr(element: Element, name: string): string | undefined;

    /** Registry being used for parsing */
    readonly registry: ParseHandlerRegistry;
}

// ============================================================================
// Parser Modules
// ============================================================================

/**
 * Interface for a Markdown parser module.
 */
export interface MarkdownParserModule {
    name: string;
    
    /** Node types this parser can handle (e.g., 'paragraph', 'text', 'html') */
    handles: string[];

    /** Priority order (lower number = higher priority, runs earlier) */
    order?: number;

    /** Handle block-level transformation */
    handleBlock?(node: MdastRootContent, ctx: ParseContext): BlockHandlerResult;

    /** Handle inline-level transformation */
    handleInline?(node: MdastRootContent, ctx: ParseContext): InlineHandlerResult;
}

/**
 * Interface for an HTML parser module.
 */
export interface HtmlParserModule {
    name: string;
    
    /** Element tags this parser can handle (e.g., 'dfn', 'xref', 'a') */
    handles: string[];

    /** Priority order (lower number = higher priority, runs earlier) */
    order?: number;

    /** Handle block-level element transformation */
    handleBlock?(element: Element, ctx: ParseContext): BlockHandlerResult;

    /** Handle inline-level element transformation */
    handleInline?(element: Element, ctx: ParseContext): InlineHandlerResult;
}

// ============================================================================
// Registry Implementation
// ============================================================================

/**
 * Registry for managing HTML and Markdown parser modules.
 */
export class ParseHandlerRegistry {
    private mdBlockHandlers = new Map<string, MarkdownParserModule[]>();
    private mdInlineHandlers = new Map<string, MarkdownParserModule[]>();
    private htmlBlockHandlers = new Map<string, HtmlParserModule>();
    private htmlInlineHandlers = new Map<string, HtmlParserModule>();

    /**
     * Register a Markdown parser module
     */
    registerMarkdownParser(parser: MarkdownParserModule): void {
        for (const nodeType of parser.handles) {
            if (parser.handleBlock) {
                const handlers = this.mdBlockHandlers.get(nodeType) || [];
                handlers.push(parser);
                handlers.sort((a, b) => (a.order ?? 10) - (b.order ?? 10));
                this.mdBlockHandlers.set(nodeType, handlers);
            }
            if (parser.handleInline) {
                const handlers = this.mdInlineHandlers.get(nodeType) || [];
                handlers.push(parser);
                handlers.sort((a, b) => (a.order ?? 10) - (b.order ?? 10));
                this.mdInlineHandlers.set(nodeType, handlers);
            }
        }
    }

    /**
     * Get block handlers for a Markdown node type
     */
    getMdBlockHandlers(nodeType: string): MarkdownParserModule[] {
        return this.mdBlockHandlers.get(nodeType) || [];
    }

    /**
     * Get inline handlers for a Markdown node type
     */
    getMdInlineHandlers(nodeType: string): MarkdownParserModule[] {
        return this.mdInlineHandlers.get(nodeType) || [];
    }

    /**
     * Register an HTML parser module
     */
    registerHtmlParser(parser: HtmlParserModule): void {
        for (const tag of parser.handles) {
            const normalizedTag = tag.toLowerCase();
            
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
     * Get block handler for an HTML tag
     */
    getHtmlBlockHandler(tagName: string): HtmlParserModule | undefined {
        return this.htmlBlockHandlers.get(tagName.toLowerCase());
    }

    /**
     * Get inline handler for an HTML tag
     */
    getHtmlInlineHandler(tagName: string): HtmlParserModule | undefined {
        return this.htmlInlineHandlers.get(tagName.toLowerCase());
    }
}

/**
 * Default global registry used by the application.
 */
export const defaultRegistry = new ParseHandlerRegistry();
