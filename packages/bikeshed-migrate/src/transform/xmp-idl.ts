/**
 * Transform <xmp class="idl"> and <pre class="idl"> elements to webidl code blocks.
 *
 * <xmp> does not require HTML entity escaping inside, so content is raw.
 * <pre class="idl"> may have HTML-escaped content that needs unescaping.
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

function getClass(node: Element): string {
    const cls = node.properties?.className;
    if (Array.isArray(cls)) return cls.join(' ');
    if (typeof cls === 'string') return cls;
    return '';
}

/**
 * Try to convert an element to a webidl code node.
 * Returns a mdast Code node if applicable, null otherwise.
 */
export function tryXmpIdl(node: Element): Code | null {
    const tag = node.tagName.toLowerCase();
    const cls = getClass(node);

    const isXmp = tag === 'xmp';
    const isIdlPre = tag === 'pre' && (cls.includes('idl') || cls.includes('webidl'));

    if (!isXmp && !isIdlPre) return null;

    // Determine language
    let lang = 'webidl';
    // <xmp class="idl"> or <xmp class="example-IDL">  — keep webidl
    // But respect explicit class overrides if needed in future

    const raw = getTextContent(node);
    // <xmp> content is not HTML-escaped; <pre class="idl"> content may be
    const value = isIdlPre ? unescapeHtml(raw).trim() : raw.trim();

    return { type: 'code', lang, value };
}
