/**
 * workspace/no-reverse-dependency rule
 * 
 * Ensures that higher-level specs do not depend on (reference) lower-level specs.
 * 
 * Rule Logic:
 * - When a reference is resolved to a definition, compare document levels
 * - If the source document has a lower level (higher priority, lower number)
 *   than the target document, report an error
 */

import type { LintRule, LintContext } from '../../types.js';
import { resolveReference, buildDefinitionIndex, collectReferences } from '../speculator-helpers.js';

export const noReverseDependencyRule: LintRule = {
    meta: {
        name: 'workspace/no-reverse-dependency',
        code: 'no-reverse-dependency',
        severity: 'error',
        description: 'Higher-level specs MUST NOT depend on lower-level specs',
        category: 'workspace'
    },

    create(context: LintContext) {
        const index = buildDefinitionIndex(context.workspace);

        return {
            onDocument(doc) {
                const sourceDocPath = doc.sourcePos?.file;
                if (!sourceDocPath) return;

                const references = collectReferences(doc);
                for (const ref of references) {
                    const candidates = resolveReference(ref, index);
                    if (candidates.length === 0) continue;

                    let target = candidates[0];
                    if (ref.targetId) {
                        const targetId = ref.targetId;
                        const targetDocId = 'targetDocumentId' in ref ? ref.targetDocumentId : undefined;
                        const match = candidates.find(c => c.id === targetId && c.documentId === targetDocId);
                        if (match) target = match;
                    }

                    const targetDocPath = target.sourcePos?.file;
                    if (!targetDocPath) continue;

                    const sourceLevel = context.level;
                    const targetLevel = context.documentLevels.get(targetDocPath) ?? 0;

                    if (sourceLevel < targetLevel) {
                        context.report({
                            message: `Higher-level spec "${sourceDocPath}" (level ${sourceLevel}) depends on lower-level spec "${targetDocPath}" (level ${targetLevel}) via term "${target.term}"`,
                            file: sourceDocPath,
                            sourcePos: ref.sourcePos
                        });
                    }
                }
            }
        };
    }
};
