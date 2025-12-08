/**
 * Parse Handler Registry
 * 
 * Provides a modular, plugin-ready architecture for tag/node handling.
 * Plugins can register handlers for HTML tags and Markdown node types.
 */

import type { Element, RootContent } from 'hast';
import type { RootContent as MdastRootContent } from 'mdast';
import type { SourceUnit } from '#src/preprocess/types';
import type { Section, Block, Inline, SourcePos } from '#src/types/ast.generated';

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
// HTML Handler Types
// ============================================================================

/**
 * Context provided to HTML tag handlers
 */
export interface HtmlParseContext {
    /** Source unit being parsed */
    readonly unit: SourceUnit;

    /** Create source position from node */
    createSourcePos(node: NodeWithPosition): SourcePos | undefined;

    /** Transform children to inline nodes */
    transformInlineChildren(children: RootContent[]): Inline[];

    /** Transform children to block nodes (recursive) */
    transformBlockChildren(children: RootContent[]): (Section | Block)[];

    /** Get text content of element */
    getTextContent(element: Element): string;

    /** Get attribute value */
    getAttr(element: Element, name: string): string | undefined;
}

/**
 * Handler for HTML tag(s)
 */
export interface HtmlTagHandler {
    /** Tag names this handler processes (e.g., ['em', 'i']) */
    readonly tags: string[];

    /** Handle a block-level element */
    handleBlock?(element: Element, ctx: HtmlParseContext): BlockHandlerResult;

    /** Handle an inline-level element */
    handleInline?(element: Element, ctx: HtmlParseContext): InlineHandlerResult;
}

// ============================================================================
// Markdown Handler Types
// ============================================================================

/**
 * Context provided to Markdown node handlers
 */
export interface MdParseContext {
    /** Source unit being parsed */
    readonly unit: SourceUnit;

    /** Create source position from node */
    createSourcePos(node: NodeWithPosition): SourcePos | undefined;

    /** Transform children to inline nodes */
    transformInlineChildren(children: MdastRootContent[]): Inline[];

    /** Transform children to block nodes (recursive) */
    transformBlockChildren(children: MdastRootContent[]): Block[];
}

/**
 * Handler for Markdown node type(s)
 */
export interface MdNodeHandler {
    /** Node types this handler processes (e.g., ['heading', 'paragraph']) */
    readonly nodeTypes: string[];

    /** Handle a block-level node */
    handleBlock?(node: MdastRootContent, ctx: MdParseContext): Block | null;

    /** Handle an inline-level node */
    handleInline?(node: MdastRootContent, ctx: MdParseContext): InlineHandlerResult;
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Registry for parse handlers
 * 
 * Allows plugins to register handlers for specific HTML tags or Markdown node types.
 */
export class ParseHandlerRegistry {
    private htmlBlockHandlers = new Map<string, HtmlTagHandler>();
    private htmlInlineHandlers = new Map<string, HtmlTagHandler>();
    private mdBlockHandlers = new Map<string, MdNodeHandler>();
    private mdInlineHandlers = new Map<string, MdNodeHandler>();

    /**
     * Register an HTML tag handler
     */
    registerHtmlHandler(handler: HtmlTagHandler): void {
        for (const tag of handler.tags) {
            const normalizedTag = tag.toLowerCase();
            if (handler.handleBlock) {
                this.htmlBlockHandlers.set(normalizedTag, handler);
            }
            if (handler.handleInline) {
                this.htmlInlineHandlers.set(normalizedTag, handler);
            }
        }
    }

    /**
     * Register a Markdown node handler
     */
    registerMdHandler(handler: MdNodeHandler): void {
        for (const nodeType of handler.nodeTypes) {
            if (handler.handleBlock) {
                this.mdBlockHandlers.set(nodeType, handler);
            }
            if (handler.handleInline) {
                this.mdInlineHandlers.set(nodeType, handler);
            }
        }
    }

    /**
     * Get HTML block handler for a tag
     */
    getHtmlBlockHandler(tagName: string): HtmlTagHandler | undefined {
        return this.htmlBlockHandlers.get(tagName.toLowerCase());
    }

    /**
     * Get HTML inline handler for a tag
     */
    getHtmlInlineHandler(tagName: string): HtmlTagHandler | undefined {
        return this.htmlInlineHandlers.get(tagName.toLowerCase());
    }

    /**
     * Get Markdown block handler for a node type
     */
    getMdBlockHandler(nodeType: string): MdNodeHandler | undefined {
        return this.mdBlockHandlers.get(nodeType);
    }

    /**
     * Get Markdown inline handler for a node type
     */
    getMdInlineHandler(nodeType: string): MdNodeHandler | undefined {
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
