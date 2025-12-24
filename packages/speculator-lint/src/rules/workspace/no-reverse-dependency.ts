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

export const noReverseDependencyRule: LintRule = {
    meta: {
        name: 'workspace/no-reverse-dependency',
        code: 'no-reverse-dependency',
        severity: 'error',
        description: 'Higher-level specs MUST NOT depend on lower-level specs',
        category: 'workspace'
    },

    create(context: LintContext) {
        return {
            onReference(ref, target) {
                // If reference is not resolved, nothing to check
                if (!target) {
                    return;
                }

                const sourceDocPath = context.document.sourcePos?.file;
                const targetDocPath = target.sourcePos?.file;

                if (!sourceDocPath || !targetDocPath) {
                    return;
                }

                // Get levels
                const sourceLevel = context.level;
                const targetLevel = context.documentLevels.get(targetDocPath) ?? 0;

                // If source is higher level (lower number) than target, that's a violation
                if (sourceLevel < targetLevel) {
                    context.report({
                        message: `Higher-level spec "${sourceDocPath}" (level ${sourceLevel}) depends on lower-level spec "${targetDocPath}" (level ${targetLevel}) via term "${target.term}"`,
                        file: sourceDocPath,
                        sourcePos: ref.sourcePos
                    });
                }
            }
        };
    }
};
