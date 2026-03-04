/**
 * Citation Resolve Plugin
 * 
 * Resolves InlineCite nodes to their bibliography entries.
 */

import type { Plugin, ResolveContext } from '#src/pipeline/types';
import type { InlineCite, IndexBiblioEntry } from '#src/types/ast.generated';
import { walkDocument } from '../walk-ast.js';

const SPECREF_API_BASE = 'https://api.specref.org/bibrefs?refs=';
const CSSWG_BIBLIO_URL = 'https://raw.githubusercontent.com/w3c/csswg-drafts/main/web-animations/respec/bibref/biblio.js';

interface SpecRefEntry {
    aliasOf?: string;
    href?: string;
    title?: string;
    authors?: unknown;
    date?: string;
    publisher?: string;
    status?: string;
    raw?: string;
}

function resolveBiblioEntry(
    biblio: Map<string, IndexBiblioEntry>,
    lowerCaseIndex: Map<string, IndexBiblioEntry>,
    key: string
): IndexBiblioEntry | undefined {
    return biblio.get(key) || lowerCaseIndex.get(key.toLowerCase());
}

function appendPath(basePath: string, pathSegment: string): string {
    const cleanedPath = pathSegment.replace(/^\/+/, '').trim();
    if (!cleanedPath) return basePath;
    if (basePath.endsWith('/')) return `${basePath}${cleanedPath}`;
    return `${basePath}/${cleanedPath}`;
}

function resolveCitationUrl(baseUrl: string, path?: string | null, fragment?: string | null): string {
    if (!path && !fragment) return baseUrl;

    try {
        const parsedUrl = new URL(baseUrl);
        if (path) {
            parsedUrl.pathname = appendPath(parsedUrl.pathname, path);
        }
        if (fragment) {
            parsedUrl.hash = fragment;
        }
        return parsedUrl.toString();
    } catch {
        // Non-fatal fallback for non-standard URL strings
        let resolved = baseUrl;
        if (path) {
            resolved = appendPath(resolved.replace(/\/+$/, ''), path);
        }
        if (fragment) {
            resolved = `${resolved.split('#')[0]}#${fragment}`;
        }
        return resolved;
    }
}

function getCitationLocator(cite: InlineCite): string | null {
    const path = cite.path?.trim();
    const fragment = cite.fragment?.trim();

    if (path && fragment) return `${path}#${fragment}`;
    if (path) return path;
    if (fragment) return fragment;
    return null;
}

function buildLowerCaseBiblioIndex(biblio: Map<string, IndexBiblioEntry>): Map<string, IndexBiblioEntry> {
    const lowerCaseBiblio = new Map<string, IndexBiblioEntry>();
    for (const [key, entry] of biblio.entries()) {
        lowerCaseBiblio.set(key.toLowerCase(), entry);
    }
    return lowerCaseBiblio;
}

function stripHtml(value: string): string {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .trim();
}

function parseCsswgRawBiblio(text: string): Map<string, string> {
    const result = new Map<string, string>();
    const entryPattern = /"([^"\\]+)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
    let match: RegExpExecArray | null = null;

    while ((match = entryPattern.exec(text))) {
        const key = match[1];
        const raw = match[2]
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');

        result.set(key.toLowerCase(), raw);
    }

    return result;
}

function extractTitleFromCsswgRaw(raw: string): string | undefined {
    const citeMatch = raw.match(/<cite>([\s\S]*?)<\/cite>/i);
    if (citeMatch?.[1]) {
        const title = stripHtml(citeMatch[1]);
        if (title) return title;
    }
    return undefined;
}

function extractUrlFromCsswgRaw(raw: string): string | undefined {
    const urlAnchorMatch = raw.match(/URL:\s*<a[^>]+href=['"]([^'"]+)['"]/i);
    if (urlAnchorMatch?.[1]) return urlAnchorMatch[1];

    const firstAnchorMatch = raw.match(/<a[^>]+href=['"]([^'"]+)['"]/i);
    if (firstAnchorMatch?.[1]) return firstAnchorMatch[1];

    return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const values = value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
    return values.length > 0 ? values : undefined;
}

function findSpecRefEntry(
    payload: Record<string, SpecRefEntry>,
    lowerCasePayload: Map<string, SpecRefEntry>,
    key: string
): SpecRefEntry | undefined {
    const direct = payload[key] || lowerCasePayload.get(key.toLowerCase());
    if (!direct) return undefined;

    if (direct.aliasOf) {
        return payload[direct.aliasOf] || lowerCasePayload.get(direct.aliasOf.toLowerCase()) || direct;
    }

    return direct;
}

function toSpecRefBiblioEntry(key: string, entry: SpecRefEntry): IndexBiblioEntry | undefined {
    const title = typeof entry.title === 'string' ? entry.title : undefined;
    const url = typeof entry.href === 'string' ? entry.href : undefined;
    const raw = typeof entry.raw === 'string' ? entry.raw : undefined;

    if (!title && !url && !raw) {
        return undefined;
    }

    return {
        key,
        title,
        url,
        authors: asStringArray(entry.authors),
        date: typeof entry.date === 'string' ? entry.date : undefined,
        publisher: typeof entry.publisher === 'string' ? entry.publisher : undefined,
        status: typeof entry.status === 'string' ? entry.status : undefined,
        raw,
    };
}

async function fetchSpecRefEntries(keys: string[]): Promise<Map<string, IndexBiblioEntry>> {
    const result = new Map<string, IndexBiblioEntry>();
    if (keys.length === 0) return result;

    try {
        const url = `${SPECREF_API_BASE}${encodeURIComponent(keys.join(','))}`;
        const response = await fetch(url);
        if (!response.ok) return result;

        const payload = await response.json() as Record<string, SpecRefEntry>;
        const lowerCasePayload = new Map<string, SpecRefEntry>();
        for (const [k, v] of Object.entries(payload)) {
            lowerCasePayload.set(k.toLowerCase(), v);
        }

        for (const key of keys) {
            const entry = findSpecRefEntry(payload, lowerCasePayload, key);
            if (!entry) continue;
            const biblioEntry = toSpecRefBiblioEntry(key, entry);
            if (biblioEntry) {
                result.set(key.toLowerCase(), biblioEntry);
            }
        }
    } catch {
        // Ignore network errors; unresolved citations remain unresolved.
    }

    return result;
}

async function fetchCsswgEntries(keys: string[]): Promise<Map<string, IndexBiblioEntry>> {
    const result = new Map<string, IndexBiblioEntry>();
    if (keys.length === 0) return result;

    try {
        const response = await fetch(CSSWG_BIBLIO_URL);
        if (!response.ok) return result;
        const text = await response.text();
        const csswgMap = parseCsswgRawBiblio(text);

        for (const key of keys) {
            const raw = csswgMap.get(key.toLowerCase());
            if (!raw) continue;

            result.set(key.toLowerCase(), {
                key,
                title: extractTitleFromCsswgRaw(raw),
                url: extractUrlFromCsswgRaw(raw),
                publisher: 'CSSWG',
                raw,
            });
        }
    } catch {
        // Ignore network errors; unresolved citations remain unresolved.
    }

    return result;
}

async function fetchExternalBibliographyEntries(keys: string[]): Promise<Map<string, IndexBiblioEntry>> {
    const result = new Map<string, IndexBiblioEntry>();
    if (keys.length === 0) return result;

    const specRefEntries = await fetchSpecRefEntries(keys);
    for (const [k, v] of specRefEntries.entries()) {
        result.set(k, v);
    }

    const missing = keys.filter((key) => !result.has(key.toLowerCase()));
    if (missing.length > 0) {
        const csswgEntries = await fetchCsswgEntries(missing);
        for (const [k, v] of csswgEntries.entries()) {
            if (!result.has(k)) {
                result.set(k, v);
            }
        }
    }

    return result;
}

function applyCitationResolution(cite: InlineCite, entry: IndexBiblioEntry): void {
    // Assign resolved ID and URL from the bibliography entry.
    // ReSpec uses bib- prefix for bibliography anchor IDs.
    cite.targetId = `bib-${entry.key}`;
    if (entry.url) {
        cite.url = resolveCitationUrl(entry.url, cite.path, cite.fragment);
    }

    const hasCustomText = !!(cite.children && cite.children.length > 0);
    const locator = getCitationLocator(cite);
    if (!hasCustomText && entry.title && (cite.expanded || locator)) {
        const suffix = locator ? ` \u00A7\u202F${locator}` : '';
        cite.children = [{ type: 'text', value: `${entry.title}${suffix}` }];
    }
}

export const citationResolvePlugin: Plugin = {
    name: 'citation-resolve',
    order: { resolve: 15 }, // After reference-resolve

    async resolve(ctx: ResolveContext): Promise<void> {
        // Use global bibliography index if available
        const biblio = ctx.workspace?.globalIndex.bibliography;
        if (!biblio) return;
        const cites: InlineCite[] = [];
        walkDocument(ctx.document, {
            visitInline: (inline) => {
                if (inline.type === 'cite') {
                    cites.push(inline as InlineCite);
                }
            },
        });

        if (cites.length === 0) return;

        let lowerCaseBiblio = buildLowerCaseBiblioIndex(biblio);

        const unresolvedKeys = new Set<string>();
        for (const cite of cites) {
            const entry = resolveBiblioEntry(biblio, lowerCaseBiblio, cite.key);
            if (entry) {
                applyCitationResolution(cite, entry);
            } else {
                unresolvedKeys.add(cite.key);
            }
        }

        if (unresolvedKeys.size === 0) return;

        const fetched = await fetchExternalBibliographyEntries(Array.from(unresolvedKeys));
        for (const entry of fetched.values()) {
            if (!biblio.has(entry.key)) {
                biblio.set(entry.key, entry);
            }
        }
        lowerCaseBiblio = buildLowerCaseBiblioIndex(biblio);

        for (const cite of cites) {
            if (cite.targetId) continue;
            const entry = resolveBiblioEntry(biblio, lowerCaseBiblio, cite.key);
            if (entry) {
                applyCitationResolution(cite, entry);
            }
        }
    },
};
