/**
 * workspace/valid-dependencies rule
 * 
 * Ensures that all dependencies listed in deps exist in the workspace.
 */

import type { LintRule, LintContext } from '../../types.js';

export const validDependenciesRule: LintRule = {
    meta: {
        name: 'workspace/valid-dependencies',
        code: 'valid-dependencies',
        severity: 'error',
        description: 'All document dependencies MUST exist in the workspace',
        category: 'workspace'
    },

    create(context: LintContext) {
        // Build a set of available document IDs in the workspace
        const availableIds = new Set(context.workspace.documents.map(doc => doc.id));

        return {
            onDocument(doc) {
                const deps = doc.metadata?.deps;
                if (!deps || !Array.isArray(deps)) return;

                const file = doc.sourcePos?.file || 'unknown';

                for (const depId of deps) {
                    if (!availableIds.has(depId)) {
                        context.report({
                            message: `Document "${doc.id}" depends on unknown document ID "${depId}"`,
                            file: file,
                            sourcePos: doc.sourcePos
                        });
                    }
                }
            }
        };
    }
};
