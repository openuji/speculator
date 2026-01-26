import type {
    Workspace,
    Document,
    IndexDefinitionEntry,
    InlineReference
} from '@openuji/speculator';
import { normalizeTerm } from '../utils.js';

/**
 * Speculator-specific reference types
 */
export const REFERENCE_TYPES = new Set([
    'workspaceDfnReference',
    'workspaceIdlReference',
    'workspaceElementReference',
    'externalDfnReference',
    'externalIdlReference',
    'externalElementReference'
]);

/**
 * Build a global definition index from workspace
 */
export function buildDefinitionIndex(workspace: Workspace): Map<string, IndexDefinitionEntry[]> {
    const index = new Map<string, IndexDefinitionEntry[]>();

    for (const doc of workspace.documents) {
        const definitions = doc.indexes?.definitions || [];
        for (const entry of definitions) {
            const uniqueTerms = new Set([entry.term, ...(entry.linkTexts || [])]);
            for (const term of uniqueTerms) {
                const key = normalizeTerm(term);
                const existing = index.get(key) || [];
                // Only push if not already present in this bucket (extra safety)
                if (!existing.includes(entry)) {
                    existing.push(entry);
                }
                index.set(key, existing);
            }
        }
    }

    return index;
}

/**
 * Collect all references from a document
 */
export function collectReferences(document: Document): InlineReference[] {
    const references: InlineReference[] = [];

    function walkNode(node: any): void {
        if (!node || typeof node !== 'object') return;

        if (node.type && REFERENCE_TYPES.has(node.type)) {
            references.push(node as InlineReference);
        }

        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                walkNode(child);
            }
        }
    }

    if (document.children) {
        for (const child of document.children) {
            walkNode(child);
        }
    }

    return references;
}

/**
 * Resolve a reference to its candidate target definitions
 */
export function resolveReference(
    ref: InlineReference,
    index: Map<string, IndexDefinitionEntry[]>
): IndexDefinitionEntry[] {

    const candidateTerms = 'candidateTerms' in ref && Array.isArray(ref.candidateTerms)
        ? ref.candidateTerms
        : [ref.targetTerm];

    let allCandidates: IndexDefinitionEntry[] = [];

    for (const term of candidateTerms) {
        const key = normalizeTerm(term);
        const entries = index.get(key);
        if (entries) {
            allCandidates.push(...entries);
        }
    }

    // Filter by forContext if specified in the reference
    const refForContexts = (ref.forContexts || []).filter((fc): fc is string => fc !== null);
    if (refForContexts.length > 0) {
        const filtered = allCandidates.filter(c => 
            (c.forContexts || [null]).some(cfc => 
                cfc !== null && refForContexts.some(rfc => normalizeTerm(cfc) === normalizeTerm(rfc))
            )
        );
        // Only narrow if we found matches for the context
        if (filtered.length > 0) {
            allCandidates = filtered;
        }
    }

    return allCandidates;
}
