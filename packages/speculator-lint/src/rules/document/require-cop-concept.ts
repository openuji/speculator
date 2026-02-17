
import type { LintRule, LintContext } from '../../types.js';

/**
 * Rule: document/require-cop-concept
 * 
 * Validates that all normative specification statements have an assigned
 * Class of Products (CoP) concept via the data-cop-concept attribute (or inherited).
 */
export const requireCopConceptRule: LintRule = {
    meta: {
        name: 'document/require-cop-concept',
        code: 'require-cop-concept',
        severity: 'error',
        description: 'Requires that all normative statements have an assigned Class of Products (CoP).',
        category: 'document'
    },

    create(context: LintContext) {
        return {
            onDocument(doc) {
                const statements = doc.indexes?.statements || [];
                
                for (const stmt of statements) {
                    // Only check normative statements
                    // Levels: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY
                    // Non-normative: NONE, AMBIGUOUS (ambiguous is flagged by parser separately usually, but here we treat it non-normative or maybe we should check it? Parser flags it as AMBIGUOUS level. Let's stick to known normative levels for now to avoid noise.)
                    const isNormative = ['MUST', 'MUST NOT', 'SHOULD', 'SHOULD NOT', 'MAY'].includes(stmt.level);
                    
                    if (isNormative) {
                        if (!stmt.subject) {
                            context.report({
                                message: `Normative statement (${stmt.level}) is missing a Class of Products subject. Assign using {data-cop-concept="..."} on the statement or a parent section.`,
                                file: stmt.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                                sourcePos: stmt.sourcePos
                            });
                        }
                    }
                }
            }
        };
    }
};
