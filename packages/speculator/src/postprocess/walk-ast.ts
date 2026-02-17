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
    ListItem,
    TableRow,
    TableCell,
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
    /** Called for list items */
    visitListItem?(item: ListItem): void;
    /** Called for table rows */
    visitTableRow?(row: TableRow): void;
    /** Called for table cells */
    visitTableCell?(cell: TableCell): void;
}

/** Inline type names for detection */
const INLINE_TYPES = new Set([
    'text', 'emphasis', 'strong', 'inlineCode', 'link', 'image',
    'definition', 
    'workspaceDfnReference', 'workspaceIdlReference', 'workspaceElementReference',
    'externalDfnReference', 'externalIdlReference', 'externalElementReference',
    'requirement', 'issue', 'cite', 'variable', 'sectionReference'
]);

/**
 * Walk all inline nodes, calling visitor.visitInline for each
 */
function walkInlines(inlines: Inline[], visitor: AstVisitor): void {
    for (const inline of inlines) {
        visitor.visitInline?.(inline);
        // Recurse into children
        if ('children' in inline && Array.isArray(inline.children)) {
            const inlineWithChildren = inline as Inline & { children: Inline[] };
            walkInlines(inlineWithChildren.children, visitor);
        }
    }
}

/**
 * Walk any node with children
 */

type AstNode = Document | Section | Block | Inline | ListItem | TableRow | TableCell;

function isAstNode(node: unknown): node is AstNode {
    return !!node && typeof node === 'object' && 'type' in node;
}

function walkNode(node: AstNode, visitor: AstVisitor): void {
    if (!node || typeof node !== 'object') return;

    // Visit current node
    switch (node.type) {
        case 'section': {
            const section = node as Section;
            visitor.visitSection?.(section);
            if (section.heading) {
                walkInlines(section.heading.children, visitor);
            }
            break;
        }
        case 'listItem':
            visitor.visitListItem?.(node as ListItem);
            break;
        case 'tableRow':
            visitor.visitTableRow?.(node as TableRow);
            break;
        case 'tableCell':
            visitor.visitTableCell?.(node as TableCell);
            break;
        default:
            if (INLINE_TYPES.has(node.type)) {
                visitor.visitInline?.(node as Inline);
            } else {
                visitor.visitBlock?.(node as Block);
            }
    }

    // Recurse into children
    // Use unsafe casting to access children but check them before walking
    const nodeWithChildren = node as unknown as { children?: unknown[] };
    if (Array.isArray(nodeWithChildren.children)) {
        const children = nodeWithChildren.children;
        if (children.length > 0) {
            const firstChild = children[0];
            // Check if first child is inline to optimize walkInlines call
            if (isAstNode(firstChild) && INLINE_TYPES.has(firstChild.type)) {
                walkInlines(children as Inline[], visitor);
            } else {
                for (const child of children) {
                    if (isAstNode(child)) {
                        walkNode(child, visitor);
                    }
                }
            }
        }
    }
}

/**
 * Walk an entire document, calling visitor methods for each node type.
 */
export function walkDocument(document: Document, visitor: AstVisitor): void {
    walkNode(document, visitor);
}
