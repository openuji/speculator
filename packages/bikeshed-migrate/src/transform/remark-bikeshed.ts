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

    // Void HTML elements (img, br, hr, …) must be self-closing in MDX (<img />).
    // Returning true forces the containing block to be re-serialised with
    // closeSelfClosing: true so the output is MDX-compatible.
    const VOID_ELEMENTS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    if (VOID_ELEMENTS.has(node.tagName)) return true;

    // <dl> blocks in Bikeshed use optional closing tags (legal HTML5) and have
    // blank lines between items. We rebuild the children list so that:
    //   1. Implicit </dt> and </dd> are closed (toHtml handles this once we give
    //      it a well-structured hast tree)
    //   2. Each <dt>/<dd> element starts on its own line (MDX requires block-level
    //      closing tags at column 1, so </dl> must appear on a fresh line)
    //   3. The trailing text node before </dl> ensures that </dl> is at column 1
    if (node.tagName === 'dl') {
        const rebuilt: ElementContent[] = [];
        for (const child of node.children) {
            // Drop existing inter-element whitespace text nodes; we'll add our own
            if (child.type === 'text') continue;
            if (child.type !== 'element') { rebuilt.push(child); continue; }
            const el = child as Element;
            if (el.tagName === 'dt') {
                // Trim trailing whitespace so </dt> closes on the same line as content.
                // MDX treats <dt> as inline; a newline before </dt> opens a new paragraph.
                for (let i = el.children.length - 1; i >= 0; i--) {
                    const c = el.children[i];
                    if (c.type === 'text') { c.value = c.value.trimEnd(); break; }
                }
            } else if (el.tagName === 'dd') {
                // Ensure <dd> content ends with \n so </dd> appears on its own line.
                // MDX requires block-level closing tags at column 1.
                const last = el.children[el.children.length - 1];
                if (last && last.type === 'text') {
                    if (!last.value.endsWith('\n')) last.value += '\n';
                } else {
                    el.children.push({ type: 'text', value: '\n' } as ElementContent);
                }
            }
            // Each element on its own line
            rebuilt.push({ type: 'text', value: '\n' } as ElementContent);
            rebuilt.push(el);
        }
        // Trailing newline ensures </dl> opens at column 1
        rebuilt.push({ type: 'text', value: '\n' } as ElementContent);
        node.children = rebuilt;
        return true;
    }

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
 * Serialise only the opening tag of an element (no children, no closing tag).
 */
function serializeOpenTag(el: Element): string {
    const empty: Element = { type: 'element', tagName: el.tagName, properties: el.properties ?? {}, children: [] };
    const full = toHtml(empty, { closeSelfClosing: true });
    const closeTag = `</${el.tagName}>`;
    const idx = full.lastIndexOf(closeTag);
    return idx >= 0 ? full.slice(0, idx) : full;
}

/**
 * Trim trailing whitespace from the last text child of an element.
 * Prevents MDX from choking on newlines before closing tags (e.g. </p>, </figcaption>).
 */
function trimLastText(el: Element): void {
    for (let i = el.children.length - 1; i >= 0; i--) {
        const c = el.children[i];
        if (c.type === 'text') {
            (c as { value: string }).value = (c as { value: string }).value.trimEnd();
            break;
        }
    }
}

/**
 * Build a mixed HTML+markdown string for wrapper elements (<figure class="example">,
 * <div class="example">). Preserves the wrapper and its class attribute so that
 * Speculator's parser can identify the block type (e.g. BlockExample). Inner
 * <pre highlight="lang"> / <xmp class="idl"> elements are converted to code fences.
 */
function buildWrapperWithFence(el: Element): string {
    const parts: string[] = [serializeOpenTag(el)];
    for (const child of el.children) {
        if (child.type === 'text' && (child as { value: string }).value.trim() === '') continue;
        if (child.type !== 'element') continue;
        const c = child as Element;
        const fence = tryPreHighlight(c) ?? tryXmpIdl(c);
        if (fence) {
            const meta = fence.meta ? ` ${fence.meta}` : '';
            parts.push(`\n\n\`\`\`${fence.lang ?? ''}${meta}\n${fence.value}\n\`\`\``);
        } else {
            // Trim trailing whitespace from text nodes to avoid MDX parse errors
            // (e.g. <p>text\n</p> causes "closing tag before end of paragraph")
            trimLastText(c);
            parts.push('\n' + toHtml(c, { closeSelfClosing: true }));
        }
    }
    parts.push(`\n</${el.tagName}>`);
    return parts.join('');
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

        // Preserve <figure class="example"> and <div class="example"> wrappers.
        // Speculator identifies block types (e.g. BlockExample) from these class
        // attributes. Convert inner <pre highlight> / <xmp> to code fences while
        // keeping the wrapper element and its attributes intact.
        const isWrapper =
            el.tagName === 'figure' ||
            (el.tagName === 'div' &&
                (String(el.properties?.className ?? '')).includes('example'));

        if (isWrapper) {
            const codeEl = findFirstCodeDescendant(el);
            if (codeEl) {
                return {
                    replacements: [{ type: 'html', value: buildWrapperWithFence(el) } as Html],
                    mutated: false,
                };
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
                // closeSelfClosing: MDX requires void elements to be self-closing (<img />)
                node.value = toHtml(hast, { closeSelfClosing: true });
            }
        });

        // Apply replacements in reverse order to preserve indices
        for (let i = toReplace.length - 1; i >= 0; i--) {
            const { parent, index, replacements } = toReplace[i];
            parent.children.splice(index, 1, ...replacements);
        }
    };
}
