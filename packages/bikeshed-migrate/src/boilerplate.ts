/**
 * Fetch and resolve Bikeshed boilerplate for a given group and status.
 *
 * Walks the speced/bikeshed-boilerplate resolution chain:
 *   1. {group}/{slot}-{status}.include
 *   2. {group}/{slot}.include
 *   3. {org}/{slot}-{status}.include   (org derived from bikeshed doctypes.kdl)
 *   4. {org}/{slot}.include
 *   5. {slot}-{status}.include
 *   6. {slot}.include
 *
 * Conformance content is extracted from the <div data-fill-with="conformance">
 * block inside the resolved footer.include file.
 *
 * All slot content is converted to Speculator-compatible Markdown via
 * boilerplateHtmlToMd() before being written to includes/*.md files.
 */

import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import type { Element, ElementContent, Text } from 'hast';
import { tryHtmlHeading } from './transform/html-headings.js';

const BOILERPLATE_RAW =
    'https://raw.githubusercontent.com/speced/bikeshed-boilerplate/main/boilerplate';

const DOCTYPES_KDL_URL =
    'https://raw.githubusercontent.com/speced/bikeshed/main/bikeshed/spec-data/readonly/boilerplate/doctypes.kdl';

export interface BoilerplateSlot {
    /** Resolved HTML/text content */
    content: string;
    /** Full URL of the source file */
    source: string;
}

export interface BoilerplateResult {
    status?: BoilerplateSlot;
    copyright?: BoilerplateSlot;
    logo?: BoilerplateSlot;
    /** Content extracted from data-fill-with="conformance" in footer.include */
    conformance?: BoilerplateSlot;
}

async function tryFetch(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const text = await res.text();
        return text.trim() || null; // empty file (e.g. root logo.include) → null
    } catch {
        return null;
    }
}

/**
 * Parse bikeshed doctypes.kdl line-by-line to resolve which org a group belongs to.
 * The KDL structure is: org "name" { group "name" ... }
 */
async function getGroupOrg(group: string): Promise<string | null> {
    const text = await tryFetch(DOCTYPES_KDL_URL);
    if (!text) return null;

    let currentOrg: string | null = null;
    let depth = 0;

    for (const line of text.split('\n')) {
        // Count braces to track nesting depth
        const opens = (line.match(/\{/g) ?? []).length;
        const closes = (line.match(/\}/g) ?? []).length;

        // org "name" { — top-level org declaration
        const orgMatch = depth === 0 ? line.match(/^org\s+"([^"]+)"/) : null;
        if (orgMatch) {
            currentOrg = orgMatch[1];
        }

        depth += opens - closes;

        // Reset org when we leave the org block
        if (depth === 0) currentOrg = null;

        // group "name" inside an org block
        const groupMatch = line.match(/^\s+group\s+"([^"]+)"/);
        if (groupMatch && groupMatch[1] === group && currentOrg) {
            return currentOrg;
        }
    }
    return null;
}

async function resolveSlot(
    group: string,
    org: string | null,
    statusName: string,
    slot: string,
): Promise<BoilerplateSlot | null> {
    const candidates: string[] = [
        `${group}/${slot}-${statusName}.include`,
        `${group}/${slot}.include`,
    ];
    if (org) {
        candidates.push(`${org}/${slot}-${statusName}.include`);
        candidates.push(`${org}/${slot}.include`);
    }
    candidates.push(`${slot}-${statusName}.include`);
    candidates.push(`${slot}.include`);

    for (const candidate of candidates) {
        const url = `${BOILERPLATE_RAW}/${candidate}`;
        const content = await tryFetch(url);
        if (content !== null) {
            return { content, source: url };
        }
    }
    return null;
}

/**
 * Extract the inner content of <div data-fill-with="conformance"> from a
 * footer.include string. Uses a depth counter to find the matching </div>.
 *
 * Also strips Bikeshed-specific elements that are irrelevant after migration:
 *   - <section include-if="..."> blocks (only for W3C WG statuses)
 *   - <wpt> elements (Web Platform Tests annotation, Bikeshed-only)
 */
function extractConformance(footer: string): string | null {
    const openTagRe = /<div\s[^>]*data-fill-with="conformance"[^>]*>/;
    const openTagMatch = footer.match(openTagRe);
    if (!openTagMatch || openTagMatch.index === undefined) return null;

    const innerStart = openTagMatch.index + openTagMatch[0].length;

    // Walk forward to find the matching </div> using a depth counter
    let depth = 1;
    let i = innerStart;

    while (i < footer.length && depth > 0) {
        const openDiv = footer.indexOf('<div', i);
        const closeDiv = footer.indexOf('</div>', i);

        if (closeDiv === -1) break;

        // Only count <div if followed by space, > or newline (not <divider> etc.)
        const isRealOpenDiv =
            openDiv !== -1 &&
            openDiv < closeDiv &&
            /^[ \t\r\n>]/.test(footer[openDiv + 4] ?? '');

        if (isRealOpenDiv) {
            depth++;
            i = openDiv + 4;
        } else {
            depth--;
            if (depth === 0) {
                let inner = footer.slice(innerStart, closeDiv).trim();
                // Strip Bikeshed-specific <section include-if="...">...</section>
                inner = inner.replace(
                    /<section\s[^>]*include-if="[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
                    '',
                );
                // Strip <wpt> elements (Web Platform Tests annotations)
                inner = inner.replace(/<wpt\b[\s\S]*?<\/wpt>/gi, '');
                inner = inner.replace(/<wpt\b[^>]*>/gi, '');
                return inner.replace(/\n{3,}/g, '\n\n').trim();
            }
            i = closeDiv + 6;
        }
    }
    return null;
}

/**
 * Fetch and resolve all boilerplate includes for a Bikeshed spec.
 *
 * @param group  - Bikeshed `Group:` value (e.g. "solidcg", "webml")
 * @param status - Bikeshed `Status:` value (e.g. "CG-DRAFT", "WD")
 * @returns Resolved slot content keyed by slot name.
 *          Missing slots (no file found, network error) are omitted.
 */
export async function fetchBoilerplate(
    group: string,
    status: string,
): Promise<BoilerplateResult> {
    const org = await getGroupOrg(group);

    const [statusSlot, copyrightSlot, logoSlot, footerSlot] = await Promise.all([
        resolveSlot(group, org, status, 'status'),
        resolveSlot(group, org, status, 'copyright'),
        resolveSlot(group, org, status, 'logo'),
        resolveSlot(group, org, status, 'footer'),
    ]);

    const result: BoilerplateResult = {};
    if (statusSlot) result.status = statusSlot;
    if (copyrightSlot) result.copyright = copyrightSlot;
    if (logoSlot) result.logo = logoSlot;

    if (footerSlot) {
        const conformanceContent = extractConformance(footerSlot.content);
        if (conformanceContent) {
            result.conformance = {
                content: conformanceContent,
                source: footerSlot.source,
            };
        }
    }

    return result;
}

// HTML elements that are block-level for the purposes of the boilerplate transform.
// <a> is intentionally absent — it acts as inline in copyright text AND as a
// wrapper for logo images; both cases are handled correctly when treated as inline.
const BLOCK_TAGS = new Set([
    'h1','h2','h3','h4','h5','h6',
    'p','div','section','article','aside','blockquote',
    'ul','ol','li','dl','dt','dd',
    'table','thead','tbody','tr','th','td',
    'figure','figcaption','pre','form','fieldset',
]);

/**
 * Recursively trim the trailing whitespace of the last text child of every <p>
 * in the subtree. MDX rejects <p>content\n</p> because the newline before the
 * closing tag is treated as opening a new paragraph.
 */
function trimParagraphEndings(el: Element): void {
    for (const child of el.children) {
        if (child.type !== 'element') continue;
        const c = child as Element;
        if (c.tagName === 'p') {
            for (let i = c.children.length - 1; i >= 0; i--) {
                const t = c.children[i];
                if (t.type === 'text') {
                    (t as Text).value = (t as Text).value.trimEnd();
                    break;
                }
            }
        }
        trimParagraphEndings(c);
    }
}

/** Get the serialised inner HTML of an element, with leading whitespace trimmed per line. */
function innerHtml(el: Element): string {
    const raw = el.children.map(child => {
        if (child.type === 'text') return (child as Text).value;
        if (child.type === 'element') return toHtml(child as Element, { closeSelfClosing: true });
        return '';
    }).join('');
    // Trim leading indentation that Bikeshed boilerplate files use (4-space indent)
    return raw.split('\n').map(l => l.trimStart()).join('\n').trim();
}

/** True if <p> has no class or id — its content can be unwrapped to a plain paragraph. */
function isPlainP(el: Element): boolean {
    const p = el.properties ?? {};
    const hasClass = Array.isArray(p.className) ? p.className.length > 0 : !!p.className;
    return el.tagName === 'p' && !hasClass && !p.id;
}

/**
 * Convert a Bikeshed boilerplate HTML fragment to Speculator-compatible Markdown.
 *
 * Rules applied to top-level nodes:
 *   - <h1>–<h6 id="x">  →  ## Heading text {#x}   (level as-is)
 *   - <p> with no attrs  →  strip tags; content (including inline HTML) becomes
 *                           a plain Markdown paragraph
 *   - <p class="…">      →  kept as HTML (e.g. <p class="note">)
 *   - <div class="…">    →  kept as HTML; hast auto-closes unclosed child tags
 *   - inline elements    →  collected and flushed together as a single text block
 *
 * "Pay attention that open tags get closed" — hast parses and re-serialises,
 * which closes all implicitly-opened tags (e.g. <p>text → <p>text</p>).
 */
export function boilerplateHtmlToMd(html: string): string {
    const hast = fromHtml(html, { fragment: true });
    const parts: string[] = [];
    // Buffer for adjacent inline nodes (text + inline elements like <a>)
    let inlineBuf: string[] = [];

    function flushInline() {
        const joined = inlineBuf.join('').trim();
        if (joined) parts.push(joined);
        inlineBuf = [];
    }

    for (const node of hast.children) {
        if (node.type === 'text') {
            const v = (node as Text).value;
            if (v.trim()) inlineBuf.push(v);
            continue;
        }
        if (node.type !== 'element') continue;
        const el = node as Element;

        if (BLOCK_TAGS.has(el.tagName)) {
            flushInline();

            // HTML heading → Markdown ATX heading
            const heading = tryHtmlHeading(el);
            if (heading !== null) {
                parts.push(heading);
                continue;
            }

            // Plain <p> → unwrap; preserve inline HTML (e.g. <a>, <code>)
            if (isPlainP(el)) {
                const inner = innerHtml(el);
                if (inner) parts.push(inner);
                continue;
            }

            // Anything else (div, p.note, etc.) → serialise as HTML.
            // hast auto-closes unclosed tags (e.g. bare <p> inside <div>).
            // Trim trailing whitespace in <p> children first so </p> is not
            // on its own line (MDX rejects "closing tag before end of paragraph").
            trimParagraphEndings(el);
            if (el.tagName === 'p') {
                // trimParagraphEndings only scans children for nested <p>; trim el itself.
                for (let i = el.children.length - 1; i >= 0; i--) {
                    const t = el.children[i];
                    if (t.type === 'text') { (t as Text).value = (t as Text).value.trimEnd(); break; }
                }
            } else {
                // Ensure block-level closing tag (</div>, </section>, …) appears on its
                // own line. MDX rejects </div> immediately after </p> on the same line.
                const last = el.children[el.children.length - 1];
                if (!last || last.type !== 'text' || !(last as Text).value.endsWith('\n')) {
                    el.children.push({ type: 'text', value: '\n' } as ElementContent);
                }
            }
            parts.push(toHtml(el, { closeSelfClosing: true }));
        } else {
            // Inline element (<a>, <code>, <span>, …) — add to buffer
            inlineBuf.push(toHtml(el, { closeSelfClosing: true }));
        }
    }

    flushInline();
    return parts.join('\n\n').trim();
}

/**
 * Render a resolved boilerplate slot as a local override .md file.
 * Converts the raw HTML content to Speculator-compatible Markdown.
 */
export function renderBoilerplateFile(
    _slot: string,
    resolved: BoilerplateSlot,
): string {
    return boilerplateHtmlToMd(resolved.content) + '\n';
}
