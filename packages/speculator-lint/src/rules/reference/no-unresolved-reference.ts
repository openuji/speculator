import type { LintRule, LintContext } from '../../types.js';
import { collectReferences } from '../speculator-helpers.js';

/**
 * Rule: reference/no-unresolved-reference
 * 
 * Ensures that all semantic references have been successfully resolved.
 * A reference is considered unresolved if its targetId or targetDocumentId (for workspace refs)
 * is missing or empty.
 */
export const noUnresolvedReferenceRule: LintRule = {
    meta: {
        name: 'reference/no-unresolved-reference',
        code: 'no-unresolved-reference',
        severity: 'error',
        description: 'References must be resolved; targetId and targetDocumentId must not be empty.',
        category: 'reference'
    },

    create(context: LintContext) {
        return {
            onDocument(doc) {
                const references = collectReferences(doc);
                for (const ref of references) {
                    switch (ref.type) {
                        case 'workspaceDfnReference':
                        case 'workspaceIdlReference':
                        case 'workspaceElementReference':
                            // Workspace references must have both targetId and targetDocumentId
                            if (!ref.targetId || !ref.targetDocumentId) {
                                context.report({
                                    message: `Unresolved workspace reference to "${ref.targetTerm || 'unknown'}". Both targetId and targetDocumentId must be populated.`,
                                    file: ref.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                                    sourcePos: ref.sourcePos
                                });
                            }
                            break;

                        case 'externalDfnReference':
                        case 'externalIdlReference':
                        case 'externalElementReference':
                            // External references must have targetId
                            if (!ref.targetId) {
                                context.report({
                                    message: `Unresolved external reference to "${ref.targetTerm || 'unknown'}". targetId is missing or empty.`,
                                    file: ref.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                                    sourcePos: ref.sourcePos
                                });
                            }
                            break;

                        case 'cite':
                            // Citations must have targetId (resolved biblio key)
                            if (!ref.targetId) {
                                context.report({
                                    message: `Unresolved citation for key "${ref.key || 'unknown'}". targetId is missing or empty.`,
                                    file: ref.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                                    sourcePos: ref.sourcePos
                                });
                            }
                            break;

                        case 'sectionReference':
                            // Section references must have targetId
                            if (!ref.targetId) {
                                context.report({
                                    message: `Unresolved section reference. targetId is missing or empty.`,
                                    file: ref.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                                    sourcePos: ref.sourcePos
                                });
                            }
                            break;
                    }
                }
            }
        };
    }
};
