/**
 * Reference Resolve Plugin
 * 
 * Resolves cross-references (xref) to their target definitions (dfn).
 * 
 * Process:
 * 1. Build lookup map from document.indexes.definitions
 * 2. Walk AST to find all InlineReference nodes
 * 3. Match references to definitions using term/candidateTerms + forContext
 * 4. Assign targetId to resolved references
 * 
 * Note: Requires dfn-index plugin to run first to populate document.indexes.definitions
 */

import type { Plugin, ResolveContext } from '#src/pipeline/types';
import type { Document, InlineReference, IndexDefinitionEntry } from '#src/types/ast.generated';

import { normalizeTerm } from '#src/parse/normalize';
import { walkDocument } from '../walk-ast.js';

/**
 * Build lookup map from definition index
 */
function buildLookupMap(document: Document): Map<string, IndexDefinitionEntry[]> {
    const map = new Map<string, IndexDefinitionEntry[]>();
    const definitions = document.indexes?.definitions || [];

    for (const entry of definitions) {
        const linkTexts = entry.linkTexts || [entry.term];

        // Index by all link texts
        for (const text of linkTexts) {
            const key = normalizeTerm(text);
            const existing = map.get(key) || [];
            existing.push(entry);
            map.set(key, existing);
        }

        // Also index by the primary term if different
        const termKey = normalizeTerm(entry.term);
        if (!linkTexts.some(lt => normalizeTerm(lt) === termKey)) {
            const existing = map.get(termKey) || [];
            existing.push(entry);
            map.set(termKey, existing);
        }
    }

    return map;
}

/**
 * Resolve a reference to a definition
 */
function resolveReference(
    ref: InlineReference,
    index: Map<string, IndexDefinitionEntry[]>
): IndexDefinitionEntry | null {
    const candidateTerms = (ref as any).candidateTerms || [ref.targetTerm];
    const forContexts = (ref as any).forContexts || [null];
    const preferredType = (ref as any).preferredType;

    // Try each candidate term
    for (const term of candidateTerms) {
        const key = normalizeTerm(term);
        const entries = index.get(key);

        if (!entries || entries.length === 0) continue;

        // Filter by forContext if specified
        let matches = entries;

        // If reference has a forContext, prefer definitions with that forContext
        const refForContext = forContexts.find((fc: string | null) => fc !== null);
        if (refForContext) {
            const exactMatches = matches.filter(e =>
                (e.forContexts || [null]).some(fc => fc && normalizeTerm(fc) === normalizeTerm(refForContext))
            );
            if (exactMatches.length > 0) {
                matches = exactMatches;
            }
        }

        // Filter by preferred type if specified
        if (preferredType && matches.length > 1) {
            const typeMatches = matches.filter(e => e.dfnType === preferredType);
            if (typeMatches.length > 0) {
                matches = typeMatches;
            }
        }

        // Return first match
        if (matches.length > 0) {
            return matches[0];
        }
    }

    return null;
}

/**
 * Walk document and resolve all references
 */
function resolveReferences(document: Document, index: Map<string, IndexDefinitionEntry[]>) {
    walkDocument(document, {
        visitInline: (inline) => {
            if (inline.type === 'reference') {
                const ref = inline as InlineReference;
                const match = resolveReference(ref, index);
                if (match) {
                    (ref as any).targetId = match.id;
                }
            }
        }
    });
}

/**
 * Reference resolve plugin
 */
export const referenceResolvePlugin: Plugin = {
    name: 'reference-resolve',
    order: { resolve: 10 },

    async resolve(ctx: ResolveContext): Promise<void> {
        // Use global index if in a workspace, otherwise build local lookup map
        const index = ctx.workspace
            ? ctx.workspace.globalIndex.definitions
            : buildLookupMap(ctx.document);

        walkDocument(ctx.document, {
            visitInline: (inline) => {
                if (inline.type === 'reference') {
                    const ref = inline as InlineReference;
                    const match = resolveReference(ref, index);

                    if (match) {
                        // Assign the resolved target ID
                        (ref as any).targetId = match.id;
                    }
                }
            }
        });
    },



};

