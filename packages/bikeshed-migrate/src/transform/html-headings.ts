/**
 * Transform HTML heading elements <h1>–<h6> to Markdown headings.
 *
 * Bikeshed HTML-centric specs (like webmcp) use HTML headings instead of
 * Markdown headings. We convert them so Speculator's Markdown parser creates
 * proper Section nodes.
 *
 * HTML headings already encode the correct depth: <h2> authors as ## because
 * <h1> is the document title. ATX headings are demoted separately (migrate.ts)
 * because markdown-centric Bikeshed specs use # as h1.
 *
 * Output format: `## Text {#id}`
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

    // Use the heading level as-is. HTML headings already encode the correct depth
    // (<h1> = document title, <h2> = top section, etc.).
    const depth = Math.min(getDepth(tag), 6);
    const hashes = '#'.repeat(depth);
    const text = extractText(node);

    const id = node.properties?.id;
    const idSuffix = id ? ` {#${id}}` : '';

    return `${hashes} ${text}${idSuffix}`;
}
