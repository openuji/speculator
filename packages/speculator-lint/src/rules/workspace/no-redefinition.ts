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
import { normalizeTerm } from '../../utils.js';
import { buildDefinitionIndex } from '../speculator-helpers.js';

export const noRedefinitionRule: LintRule = {
    meta: {
        name: 'workspace/no-redefinition',
        code: 'no-redefinition',
        severity: 'error',
        description: 'Lower-level specs MUST NOT redefine concepts from higher-level specs',
        category: 'workspace'
    },

    create(context: LintContext) {
        const index = buildDefinitionIndex(context.workspace);

        return {
            onDocument(doc) {
                const currentDocPath = doc.sourcePos?.file;
                if (!currentDocPath) return;

                const definitions = doc.indexes?.definitions || [];
                for (const entry of definitions) {
                    const allEntriesForTerm = index.get(normalizeTerm(entry.term)) || [];
                    
                    if (allEntriesForTerm.length <= 1) continue;

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

                    const currentLevel = context.documentLevels.get(currentDocPath) ?? 0;
                    const higherDocPath = highestEntry.sourcePos?.file;

                    if (currentLevel > highestLevel && higherDocPath) {
                        if (currentDocPath === higherDocPath) continue;

                        context.report({
                            message: `Lower-level spec "${currentDocPath}" redefines concept "${entry.term}" already defined in higher-level spec "${higherDocPath}"`,
                            file: currentDocPath,
                            sourcePos: entry.sourcePos
                        });
                    }
                }
            }
        };
    }
};
