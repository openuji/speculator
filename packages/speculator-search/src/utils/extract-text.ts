/**
 * Text Extraction Utilities
 * 
 * Utilities for extracting plain text from AST inline nodes.
 */

import type { Inline } from '@openuji/speculator';

/**
 * Extract plain text from inline nodes, recursively handling all inline types
 */
export function extractTextFromInlines(inlines: Inline[]): string {
    return inlines.map(inline => extractTextFromInline(inline)).join('');
}

/**
 * Extract plain text from a single inline node
 */
export function extractTextFromInline(inline: Inline): string {
    switch (inline.type) {
        case 'text':
            return inline.value;

        case 'emphasis':
        case 'strong':
        case 'link':
            return extractTextFromInlines(inline.children);

        case 'inlineCode':
            return inline.value;

        case 'definition':
            return inline.term;

        case 'workspaceDfnReference':
        case 'workspaceIdlReference':
        case 'workspaceElementReference':
        case 'externalDfnReference':
        case 'externalIdlReference':
        case 'externalElementReference':
            return inline.targetTerm;

        case 'requirement':
            return inline.keyword;

        case 'issue':
            return extractTextFromInlines(inline.children);

        case 'cite':
            return inline.children
                ? extractTextFromInlines(inline.children)
                : inline.key;

        case 'image':
            return inline.alt || '';

        default:
            return '';
    }
}

/**
 * Strip formatting and normalize text for search
 */
export function normalizeTextForSearch(text: string): string {
    return text
        .toLowerCase()
        .trim()
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Remove special characters but keep alphanumeric and spaces
        .replace(/[^\w\s-]/g, '');
}
