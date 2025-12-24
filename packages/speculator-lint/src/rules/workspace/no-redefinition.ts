/**
 * workspace/no-redefinition rule
 * 
 * Ensures that lower-level specs do not redefine concepts from higher-level specs.
 * 
 * Rule Logic:
 * - When a term is defined in multiple documents, compare their levels
 * - If a lower-level document (higher number) redefines a term from a higher-level document,
 *   report an error
 */

import type { LintRule, LintContext } from '../../types.js';

export const noRedefinitionRule: LintRule = {
    meta: {
        name: 'workspace/no-redefinition',
        code: 'no-redefinition',
        severity: 'error',
        description: 'Lower-level specs MUST NOT redefine concepts from higher-level specs',
        category: 'workspace'
    },

    create(context: LintContext) {
        return {
            onDefinition(entry, allEntriesForTerm) {
                // If this is the first definition of this term, no issue
                if (allEntriesForTerm.length === 0) {
                    return;
                }

                // Find the highest-level (lowest number) definition
                let highestEntry = allEntriesForTerm[0];
                let highestLevel = Infinity;

                for (const existingEntry of allEntriesForTerm) {
                    const docPath = existingEntry.sourcePos?.file;
                    if (!docPath) continue;

                    const level = context.documentLevels.get(docPath) ?? 0;
                    if (level < highestLevel) {
                        highestLevel = level;
                        highestEntry = existingEntry;
                    }
                }

                // Check if current entry is from a lower level
                const currentDocPath = entry.sourcePos?.file;
                if (!currentDocPath) return;

                const currentLevel = context.documentLevels.get(currentDocPath) ?? 0;
                const higherDocPath = highestEntry.sourcePos?.file;

                // If current level is lower (higher number) than the highest definition
                if (currentLevel > highestLevel && higherDocPath) {
                    // Skip if this is the same document (shouldn't happen, but just in case)
                    if (currentDocPath === higherDocPath) {
                        return;
                    }

                    context.report({
                        message: `Lower-level spec "${currentDocPath}" redefines concept "${entry.term}" already defined in higher-level spec "${higherDocPath}"`,
                        file: currentDocPath,
                        sourcePos: entry.sourcePos
                    });
                }
            }
        };
    }
};
