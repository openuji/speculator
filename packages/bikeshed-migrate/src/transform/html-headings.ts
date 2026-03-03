/**
 * Transform HTML heading elements <h1>–<h6> to Markdown headings.
 *
 * Bikeshed HTML-centric specs (like webmcp) use HTML headings instead of
 * Markdown headings. We convert them so Speculator's Markdown parser creates
 * proper Section nodes.
 *
 * Output format: `## Text ## {#id}` (Speculator ATX heading with optional id).
 */

import type { Element, Text } from 'hast';

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function getDepth(tag: string): number {
    return parseInt(tag[1], 10);
}

function extractText(node: Element): string {
    let text = '';
    for (const child of node.children) {
        if (child.type === 'text') {
            text += (child as Text).value;
        } else if (child.type === 'element') {
            text += extractText(child as Element);
        }
    }
    return text.trim();
}

/**
 * Try to convert an HTML heading element to a Markdown heading string.
 * Returns the Markdown string if applicable, null otherwise.
 */
export function tryHtmlHeading(node: Element): string | null {
    const tag = node.tagName.toLowerCase();
    if (!HEADING_TAGS.has(tag)) return null;

    const depth = getDepth(tag);
    const hashes = '#'.repeat(depth);
    const text = extractText(node);

    const id = node.properties?.id;
    const idSuffix = id ? ` {#${id}}` : '';

    // Format: `## Text ## {#id}` (ATX with closing hashes for ReSpec compatibility)
    return `${hashes} ${text} ${hashes}${idSuffix}`;
}
