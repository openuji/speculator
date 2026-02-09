/**
 * Rule execution engine
 * 
 * Lean, generic visitor driver.
 */

import type { Workspace } from '@openuji/speculator';
import type {
    LintRule,
    LintContext,
    LintDiagnostic,
    RuleResult
} from './types.js';

/**
 * Run a single rule against a workspace
 */
export async function runRule(
    rule: LintRule,
    workspace: Workspace,
    documentLevels: Map<string, number>
): Promise<RuleResult> {
    const startTime = performance.now();
    const diagnostics: LintDiagnostic[] = [];

    for (const document of workspace.documents) {
        const level = documentLevels.get(document.sourcePos?.file || '') ?? 0;

        const context: LintContext = {
            workspace,
            documentLevels,
            document,
            level,
            report: (diagnostic) => {
                diagnostics.push({
                    code: rule.meta.code,
                    severity: rule.meta.severity,
                    ...diagnostic
                });
            }
        };

        const visitor = rule.create(context);

        if (visitor.onDocument) {
            await visitor.onDocument(document);
        }
    }

    const endTime = performance.now();

    return {
        ruleName: rule.meta.name,
        diagnostics,
        executionTime: endTime - startTime
    };
}
