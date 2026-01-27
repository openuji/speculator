/**
 * document/no-duplicate-definition rule
 * 
 * Ensures that a single document does not define the same term multiple times.
 * Duplicate definitions cause ambiguity during reference resolution.
 */

import type { IndexDefinitionEntry } from '@openuji/speculator';
import type { LintRule, LintContext } from '../../types.js';
import { normalizeTerm } from '../../utils.js';
import { buildDefinitionIndex } from '../speculator-helpers.js';

export const noDuplicateDefinitionRule: LintRule = {
    meta: {
        name: 'document/no-duplicate-definition',
        code: 'no-duplicate-definition',
        severity: 'error',
        description: 'A single document MUST NOT define the same term multiple times',
        category: 'document'
    },

    create(context: LintContext) {
        const index = buildDefinitionIndex(context.workspace);

        return {
            onDocument(doc) {
                const docPath = doc.sourcePos?.file;
                const definitions = doc.indexes?.definitions || [];

                for (const entry of definitions) {
                    const allNames = new Set([entry.term, ...(entry.linkTexts || [])]);
                    const entryContexts = entry.forContexts && entry.forContexts.length > 0 ? entry.forContexts : [null];

                    let reportedForThisEntry = false;
                    for (const name of allNames) {
                        if (reportedForThisEntry) break;

                        const key = normalizeTerm(name);
                        const candidates = index.get(key) || [];

                        for (const cand of candidates) {
                            if (cand === entry || cand.id === entry.id) continue;
                            if (cand.sourcePos?.file !== docPath) continue;

                            const candContexts = cand.forContexts && cand.forContexts.length > 0 ? cand.forContexts : [null];
                            const hasOverlap = entryContexts.some(ctx => candContexts.includes(ctx));

                            if (hasOverlap) {
                                const entryLine = entry.sourcePos?.line || 0;
                                const candLine = cand.sourcePos?.line || 0;
                                
                                if (entryLine > candLine || (entryLine === candLine && (entry.sourcePos?.column || 0) > (cand.sourcePos?.column || 0))) {
                                    context.report({
                                        message: `Duplicate definition of term/alias "${name}" within the same document`,
                                        file: docPath,
                                        sourcePos: entry.sourcePos
                                    });
                                    reportedForThisEntry = true;
                                    break; 
                                }
                            }
                        }
                    }
                }
            }
        };
    }
};
