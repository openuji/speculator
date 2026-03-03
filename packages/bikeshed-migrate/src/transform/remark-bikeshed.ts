/**
 * Remark plugin that transforms Bikeshed-specific constructs inside HTML blocks.
 *
 * Remark parses HTML islands in Markdown as `html` nodes (raw strings).
 * This plugin:
 *   1. Parses each `html` node with hast-util-from-html
 *   2. Applies Bikeshed transforms:
 *      a. Top-level single elements convertible to mdast (code, heading) → replace the html node
 *      b. Nested elements → mutate hast in-place, re-serialise as HTML
 */

import { visit, SKIP } from 'unist-util-visit';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import type { Root, Html } from 'mdast';
import type { Element, Root as HastRoot, ElementContent } from 'hast';
import { tryXmpIdl } from './xmp-idl.js';
import { tryPreHighlight } from './pre-highlight.js';
import { tryHtmlHeading } from './html-headings.js';
import { tryAlgorithmDiv } from './algorithm-div.js';

type MdastNode = Root['children'][number];

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
        if (child.type === 'text') text += child.value;
        else if (child.type === 'element') text += getTextContent(child);
    }
    return text;
}

/**
 * Recursively mutate a hast element, applying Bikeshed-specific transforms in-place.
 * Returns true if any mutation was made.
 */
function mutateElement(node: Element): boolean {
    let mutated = false;

    // <div algorithm> → <section data-algorithm>
    if (tryAlgorithmDiv(node)) mutated = true;

    // <pre highlight="lang"> → <pre><code class="language-X"> (in-place, skip children after)
    const highlight = node.properties?.highlight;
    if (node.tagName === 'pre' && highlight) {
        const lang = String(highlight).trim();
        const value = unescapeHtml(getTextContent(node)).trim();
        delete node.properties!.highlight;
        node.children = [
            {
                type: 'element',
                tagName: 'code',
                properties: { className: [`language-${lang}`] },
                children: [{ type: 'text', value }],
            } as ElementContent,
        ];
        return true; // children replaced, do not recurse further
    }

    // <xmp class="idl"> → <pre><code class="language-webidl"> (in-place, skip children after)
    if (node.tagName === 'xmp') {
        const code = tryXmpIdl(node);
        if (code) {
            node.tagName = 'pre';
            node.properties = {};
            node.children = [
                {
                    type: 'element',
                    tagName: 'code',
                    properties: { className: ['language-webidl'] },
                    children: [{ type: 'text', value: code.value }],
                } as ElementContent,
            ];
            return true;
        }
    }

    // Recurse into children
    for (const child of node.children) {
        if (child.type === 'element') {
            if (mutateElement(child as Element)) mutated = true;
        }
    }

    return mutated;
}

/**
 * Find the first <pre highlight="lang"> or <xmp class="idl"> descendant of el.
 */
function findFirstCodeDescendant(el: Element): Element | null {
    for (const child of el.children) {
        if (child.type !== 'element') continue;
        const c = child as Element;
        if (c.tagName === 'pre' && c.properties?.highlight) return c;
        if (c.tagName === 'xmp') return c;
        const found = findFirstCodeDescendant(c);
        if (found) return found;
    }
    return null;
}

/**
 * Walk hast tree. Returns mdast replacements if the entire block can be
 * converted directly; otherwise mutates hast in-place for re-serialisation.
 */
function transformHast(hast: HastRoot): { replacements: MdastNode[]; mutated: boolean } {
    // Ignore whitespace-only text nodes when determining block structure
    const significant = hast.children.filter(
        c => !(c.type === 'text' && c.value.trim() === '')
    );

    // If the block is a single top-level element, try direct mdast conversion
    if (significant.length === 1 && significant[0].type === 'element') {
        const el = significant[0] as Element;

        const codeNode = tryXmpIdl(el);
        if (codeNode) return { replacements: [codeNode], mutated: false };

        const highlightNode = tryPreHighlight(el);
        if (highlightNode) return { replacements: [highlightNode], mutated: false };

        const headingStr = tryHtmlHeading(el);
        if (headingStr !== null) {
            return {
                replacements: [{ type: 'html', value: headingStr } as Html],
                mutated: false,
            };
        }

        // Hoist code blocks out of example/figure wrappers.
        // Bikeshed often wraps <pre highlight="lang"> in <figure class="example">
        // or <div class='example'>. We extract the first code block so the
        // migration output uses clean markdown code fences.
        const isWrapper =
            el.tagName === 'figure' ||
            (el.tagName === 'div' &&
                (String(el.properties?.className ?? '')).includes('example'));

        if (isWrapper) {
            const codeEl = findFirstCodeDescendant(el);
            if (codeEl) {
                const hoisted = tryPreHighlight(codeEl) ?? tryXmpIdl(codeEl);
                if (hoisted) return { replacements: [hoisted], mutated: false };
            }
        }
    }

    // Deep mutation pass for complex/nested blocks
    let mutated = false;
    for (const child of hast.children) {
        if (child.type === 'element') {
            if (mutateElement(child as Element)) mutated = true;
        }
    }

    return { replacements: [], mutated };
}

/**
 * The remark plugin.
 * Exported as a function so it works with .use(remarkBikeshed).
 */
export function remarkBikeshed() {
    return (tree: Root) => {
        const toReplace: Array<{
            parent: { children: MdastNode[] };
            index: number;
            replacements: MdastNode[];
        }> = [];

        visit(tree, 'html', (node: Html, index, parent) => {
            if (index === undefined || parent === undefined) return;

            const hast = fromHtml(node.value, { fragment: true });
            const { replacements, mutated } = transformHast(hast);

            if (replacements.length > 0) {
                toReplace.push({ parent: parent as { children: MdastNode[] }, index, replacements });
                return SKIP;
            }

            if (mutated) {
                node.value = toHtml(hast);
            }
        });

        // Apply replacements in reverse order to preserve indices
        for (let i = toReplace.length - 1; i >= 0; i--) {
            const { parent, index, replacements } = toReplace[i];
            parent.children.splice(index, 1, ...replacements);
        }
    };
}
