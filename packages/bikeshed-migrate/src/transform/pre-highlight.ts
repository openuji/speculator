/**
 * Transform <pre highlight="lang"> elements to fenced code blocks.
 *
 * Bikeshed uses <pre highlight="turtle"> for syntax-highlighted code.
 * Content may be HTML-escaped.
 */

import type { Element } from 'hast';
import type { Code } from 'mdast';

function unescapeHtml(text: string): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
}

function getTextContent(node: Element): string {
    let text = '';
    for (const child of node.children) {
        if (child.type === 'text') {
            text += child.value;
        } else if (child.type === 'element') {
            text += getTextContent(child);
        }
    }
    return text;
}

/**
 * Try to convert a <pre highlight="lang"> element to a code node.
 * Returns a mdast Code node if applicable, null otherwise.
 */
export function tryPreHighlight(node: Element): Code | null {
    if (node.tagName.toLowerCase() !== 'pre') return null;

    const highlight = node.properties?.highlight ?? node.properties?.['data-highlight'];
    if (!highlight) return null;

    const lang = String(highlight).trim();
    const raw = getTextContent(node);
    const value = unescapeHtml(raw).trim();

    // Also handle line-highlight attribute as metadata (e.g. "9")
    const lineHighlight = node.properties?.lineHighlight ?? node.properties?.['line-highlight'];
    const meta = lineHighlight ? `{${lineHighlight}}` : undefined;

    const node_: Code = { type: 'code', lang, value };
    if (meta) node_.meta = meta;
    return node_;
}
