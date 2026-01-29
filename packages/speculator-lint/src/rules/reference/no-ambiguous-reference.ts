import type { IndexDefinitionEntry } from '@openuji/speculator';
import type { LintRule, LintContext } from '../../types.js';
import { resolveReference, buildDefinitionIndex, collectReferences } from '../speculator-helpers.js';

export const noAmbiguousReferenceRule: LintRule = {
    meta: {
        name: 'reference/no-ambiguous-reference',
        code: 'no-ambiguous-reference',
        severity: 'warning',
        description: 'References SHOULD NOT be ambiguous (resolve to multiple definitions)',
        category: 'reference'
    },

    create(context: LintContext) {
        const index = buildDefinitionIndex(context.workspace);

        return {
            onDocument(doc) {
                const references = collectReferences(doc);
                for (const ref of references) {
                    const allCandidates = resolveReference(ref, index);

                    // Deduplicate by term identity (document + term + context)
                    // If a term is defined twice in the same context in the same file, 
                    // that's a duplicate-definition error. For ambiguity purposes, 
                    // we treat them as one logical candidate to avoid spamming the user.
                    const uniqueCandidatesMap = new Map<string, IndexDefinitionEntry>();
                    for (const c of allCandidates) {
                        const contextsKey = (c.forContexts || []).sort().join(',');
                        const key = `${c.documentId}#${c.term}#${contextsKey}`;
                        uniqueCandidatesMap.set(key, c);
                    }
                    const uniqueCandidates = Array.from(uniqueCandidatesMap.values());

                    if (uniqueCandidates.length <= 1) continue;

                    // Handle disambiguation via forContexts
                    const refContexts = ('forContexts' in ref ? ref.forContexts : []) || [null];
                    const hasExplicitContext = refContexts.length > 0 && refContexts[0] !== null;
                    
                    let conflictCount = uniqueCandidates.length;

                    if (hasExplicitContext) {
                        const matches = uniqueCandidates.filter(c => {
                             const candContexts = c.forContexts && c.forContexts.length > 0 ? c.forContexts : [null];
                             return candContexts.some(fc => refContexts.includes(fc as string));
                        });
                        conflictCount = matches.length;
                    }

                    if (conflictCount > 1) {
                        const locations = uniqueCandidates
                            .map(c => `${c.sourcePos?.file}:${c.sourcePos?.line}`)
                            .slice(0, 3)
                            .join(', ');
                        const suffix = uniqueCandidates.length > 3 ? '...' : '';

                        const targetTerm = 'targetTerm' in ref ? ref.targetTerm : ('key' in ref ? ref.key : 'unknown');

                        context.report({
                            message: `Ambiguous reference to "${targetTerm}" matches ${uniqueCandidates.length} definitions at: ${locations}${suffix}`,
                            file: ref.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                            sourcePos: ref.sourcePos
                        });
                    }
                }
            }
        };
    }
};
