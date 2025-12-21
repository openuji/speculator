/**
 * AST Walker Utility
 * 
 * Provides a generic visitor pattern for walking the SpecAST.
 * Used by postprocess plugins to traverse document structure.
 */

import type {
    Document,
    Section,
    Block,
    Inline,
} from '#src/types/ast.generated';


/**
 * Visitor interface for AST traversal.
 * Implement only the methods you need.
 */
export interface AstVisitor {
    /** Called for each inline node */
    visitInline?(inline: Inline): void;
    /** Called for each block node */
    visitBlock?(block: Block): void;
    /** Called for each section node */
    visitSection?(section: Section): void;
}

/** Inline type names for detection */
const INLINE_TYPES = new Set([
    'text', 'emphasis', 'strong', 'inlineCode', 'link', 'image',
    'definition', 'reference', 'requirement', 'issue', 'cite'
]);

/**
 * Walk all inline nodes, calling visitor.visitInline for each
 */
function walkInlines(inlines: Inline[], visitor: AstVisitor): void {
    for (const inline of inlines) {
        visitor.visitInline?.(inline);
        // Recurse into children
        if ('children' in inline && Array.isArray((inline as any).children)) {
            walkInlines((inline as any).children, visitor);
        }
    }
}

/**
 * Walk a block node and its children
 */
function walkBlock(block: Block, visitor: AstVisitor): void {
    visitor.visitBlock?.(block);

    if ('children' in block) {
        const children = (block as any).children;
        if (Array.isArray(children) && children.length > 0) {
            const firstChild = children[0];
            if (firstChild && typeof firstChild === 'object' && 'type' in firstChild) {
                if (INLINE_TYPES.has(firstChild.type)) {
                    walkInlines(children, visitor);
                } else {
                    for (const child of children) {
                        walkBlock(child, visitor);
                    }
                }
            }
        }
    }
}

/**
 * Walk a section node and its children
 */
function walkSection(section: Section, visitor: AstVisitor): void {
    visitor.visitSection?.(section);

    // Walk heading if present
    if (section.heading) {
        walkInlines(section.heading.children, visitor);
    }

    // Walk children
    for (const child of section.children) {
        if (child.type === 'section') {
            walkSection(child, visitor);
        } else {
            walkBlock(child, visitor);
        }
    }
}

/**
 * Walk an entire document, calling visitor methods for each node type.
 * 
 * @param document - The document to traverse
 * @param visitor - Visitor with optional callbacks for each node type
 * 
 * @example
 * ```typescript
 * walkDocument(doc, {
 *     visitInline: (inline) => {
 *         if (inline.type === 'definition') {
 *             // process definition
 *         }
 *     }
 * });
 * ```
 */
export function walkDocument(document: Document, visitor: AstVisitor): void {
    for (const child of document.children) {
        if (child.type === 'section') {
            walkSection(child, visitor);
        } else {
            walkBlock(child, visitor);
        }
    }
}
