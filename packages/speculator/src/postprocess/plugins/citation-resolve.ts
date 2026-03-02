/**
 * Citation Resolve Plugin
 * 
 * Resolves InlineCite nodes to their bibliography entries.
 */

import type { Plugin, ResolveContext } from '#src/pipeline/types';
import type { InlineCite, IndexBiblioEntry } from '#src/types/ast.generated';
import { walkDocument } from '../walk-ast.js';

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

export const citationResolvePlugin: Plugin = {
    name: 'citation-resolve',
    order: { resolve: 15 }, // After reference-resolve

    async resolve(ctx: ResolveContext): Promise<void> {
        // Use global bibliography index if available
        const biblio = ctx.workspace?.globalIndex.bibliography;
        if (!biblio) return;
        const lowerCaseBiblio = new Map<string, IndexBiblioEntry>();
        for (const [key, entry] of biblio.entries()) {
            lowerCaseBiblio.set(key.toLowerCase(), entry);
        }

        walkDocument(ctx.document, {
            visitInline: (inline) => {
                if (inline.type === 'cite') {
                    const cite = inline as InlineCite;
                    const entry = resolveBiblioEntry(biblio, lowerCaseBiblio, cite.key);

                    if (entry) {
                        // Assign resolved ID and URL from the bibliography entry
                        // ReSpec uses bib- prefix for bibliography anchor IDs
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
                }
            }
        });
    },
};
