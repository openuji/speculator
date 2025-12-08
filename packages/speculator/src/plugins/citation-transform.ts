/**
 * Citation Transform Plugin
 * 
 * Scans text nodes for bracket citation patterns and transforms them
 * into InlineCite nodes.
 * 
 * Patterns:
 * - [[FOO]] - basic citation
 * - [[!FOO]] - forced normative
 * - [[?FOO]] - forced informative  
 * - [[[FOO]]] - expanded (shows full title)
 * - [[\FOO]] - escaped (should be skipped)
 */

import type { Plugin, TransformContext } from '#src/pipeline/types';
import type {
    SpeculatorASTSchema as Document,
    Section,
    Block,
    Inline,
    InlineText,
    InlineCite,
} from '#src/types/ast.generated';
import { normalizeTerm } from '#src/parse/normalize';

/**
 * Citation pattern regex.
 * 
 * Groups:
 * 1. Expanded marker (third bracket)
 * 2. Modifier (!, ?, or \)
 * 3. Citation key
 */
const CITATION_PATTERN = /\[\[(\[)?([!?\\])?([^\]\[]+)\]\](\])?/g;

/**
 * Parse citation match to determine properties
 */
interface ParsedCitation {
    key: string;
    forcedNormative: boolean;
    forcedInformative: boolean;
    expanded: boolean;
    escaped: boolean;
    startIndex: number;
    endIndex: number;
    raw: string;
}

function parseCitationMatch(match: RegExpExecArray): ParsedCitation {
    const [raw, openBracket, modifier, key, closeBracket] = match;
    const expanded = !!openBracket && !!closeBracket;

    return {
        key: normalizeTerm(key),
        forcedNormative: modifier === '!',
        forcedInformative: modifier === '?',
        expanded,
        escaped: modifier === '\\',
        startIndex: match.index,
        endIndex: match.index + raw.length,
        raw,
    };
}

/**
 * Transform a text node containing citations into an array of nodes.
 * Returns null if no citations found.
 */
function transformTextWithCitations(text: InlineText): Inline[] | null {
    const value = text.value;
    CITATION_PATTERN.lastIndex = 0;

    const citations: ParsedCitation[] = [];
    let match: RegExpExecArray | null;

    while ((match = CITATION_PATTERN.exec(value)) !== null) {
        citations.push(parseCitationMatch(match));
    }

    if (citations.length === 0) {
        return null;
    }

    const result: Inline[] = [];
    let lastIndex = 0;

    for (const citation of citations) {
        // Add text before citation
        if (citation.startIndex > lastIndex) {
            const before = value.slice(lastIndex, citation.startIndex);
            if (before) {
                result.push({ type: 'text', value: before });
            }
        }

        if (citation.escaped) {
            // Escaped citation: output as text without backslash
            result.push({ type: 'text', value: `[[${citation.key}]]` });
        } else {
            // Create citation node
            const cite: InlineCite = {
                type: 'cite',
                key: citation.key,
            };

            if (citation.expanded) {
                cite.expanded = true;
            }
            if (citation.forcedNormative) {
                cite.forcedNormative = true;
                cite.kind = 'normative';
            }
            if (citation.forcedInformative) {
                cite.forcedInformative = true;
                cite.kind = 'informative';
            }

            result.push(cite);
        }

        lastIndex = citation.endIndex;
    }

    // Add text after last citation
    if (lastIndex < value.length) {
        result.push({ type: 'text', value: value.slice(lastIndex) });
    }

    return result;
}

/**
 * Recursively transform children of inline array
 */
function transformInlineChildren(children: Inline[]): Inline[] {
    const result: Inline[] = [];

    for (const child of children) {
        if (child.type === 'text') {
            const transformed = transformTextWithCitations(child);
            if (transformed) {
                result.push(...transformed);
            } else {
                result.push(child);
            }
        } else if ('children' in child && Array.isArray(child.children)) {
            // Recursively process children of container nodes
            (child as any).children = transformInlineChildren((child as any).children);
            result.push(child);
        } else {
            result.push(child);
        }
    }

    return result;
}

/**
 * Transform block children recursively
 */
function transformBlock(block: Block): void {
    if ('children' in block && Array.isArray(block.children)) {
        if (block.type === 'paragraph' || block.type === 'heading') {
            // These have Inline[] children
            (block as any).children = transformInlineChildren((block as any).children);
        } else {
            // These have Block[] children (list items, blockquote, etc.)
            for (const child of (block as any).children) {
                if (typeof child === 'object' && child !== null) {
                    transformBlock(child);
                }
            }
        }
    }
}

/**
 * Transform section recursively
 */
function transformSection(section: Section): void {
    // Transform heading if present
    if (section.heading) {
        section.heading.children = transformInlineChildren(section.heading.children);
    }

    // Transform children
    for (const child of section.children) {
        if (child.type === 'section') {
            transformSection(child);
        } else {
            transformBlock(child);
        }
    }
}

/**
 * Citation transform plugin
 */
export const citationTransformPlugin: Plugin = {
    name: 'citation-transform',
    order: { transform: 10 },

    async transform(ctx: TransformContext): Promise<void> {
        const document = ctx.document;

        // Transform all children (sections and blocks)
        for (const child of document.children) {
            if (child.type === 'section') {
                transformSection(child);
            } else {
                transformBlock(child);
            }
        }
    },
};
