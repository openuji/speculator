/**
 * SpeculatorLinter - Main linter class
 */

import type {
    LintRule,
    LintOptions,
    LintResult,
    LintConfig,
    LintDiagnostic
} from './types.js';
import { runRule } from './rule-runner.js';
import { getRuleSeverity } from './config.js';

/**
 * Main linter class
 */
export class SpeculatorLinter {
    private rules: Map<string, LintRule> = new Map();

    /**
     * Create a new linter instance
     * @param rules Array of lint rules to use
     */
    constructor(rules: LintRule[]) {
        for (const rule of rules) {
            this.rules.set(rule.meta.name, rule);
        }
    }

    /**
     * Lint a workspace
     * @param options Lint options
     * @returns Lint result with diagnostics
     */
    async lint(options: LintOptions): Promise<LintResult> {
        const startTime = performance.now();
        const config = options.config || { rules: {} };
        const ruleResults = new Map();
        const allDiagnostics: LintDiagnostic[] = [];

        // Run each enabled rule
        for (const [ruleName, rule] of this.rules) {
            // Check if rule is enabled in config
            if (!this.isRuleEnabled(config, ruleName)) {
                continue;
            }

            // Get effective severity from config
            const configuredSeverity = this.getConfiguredSeverity(config, ruleName);

            // Run the rule
            const result = await runRule(rule, options.workspace, options.documentLevels);

            // Override severity if configured
            if (configuredSeverity && configuredSeverity !== rule.meta.severity) {
                for (const diagnostic of result.diagnostics) {
                    diagnostic.severity = configuredSeverity;
                }
            }

            ruleResults.set(ruleName, result);
            allDiagnostics.push(...result.diagnostics);
        }

        const endTime = performance.now();

        return {
            diagnostics: allDiagnostics,
            hasErrors: allDiagnostics.some(d => d.severity === 'error'),
            ruleResults: Array.from(ruleResults.values()),
            totalTime: endTime - startTime
        };
    }

    /**
     * Check if a rule is enabled in the configuration
     */
    private isRuleEnabled(config: LintConfig, ruleName: string): boolean {
        const ruleConfig = config.rules?.[ruleName];
        const severity = getRuleSeverity(ruleConfig);
        return severity !== null;
    }

    /**
     * Get the configured severity for a rule
     */
    private getConfiguredSeverity(config: LintConfig, ruleName: string): 'error' | 'warning' | 'info' | null {
        return getRuleSeverity(config.rules?.[ruleName]);
    }

    /**
     * Get available rules
     */
    getRules(): LintRule[] {
        return Array.from(this.rules.values());
    }
}
