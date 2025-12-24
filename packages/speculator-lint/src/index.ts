/**
 * @openuji/speculator-lint
 * 
 * Standalone linter for Speculator workspace AST
 */

// Main linter class
export { SpeculatorLinter } from './linter.js';

// Types for creating custom rules
export type {
    LintRule,
    LintContext,
    LintVisitor,
    LintDiagnostic,
    LintResult,
    LintOptions,
    LintConfig,
    RuleMetadata,
    RuleResult,
    Severity,
    RuleCategory
} from './types.js';

// Configuration utilities
export {
    loadConfig,
    loadConfigFromDefaults,
    defaultConfig,
    recommendedConfig
} from './config.js';

// Built-in rules
export {
    builtInRules,
    getRuleByName,
    noRedefinitionRule,
    noReverseDependencyRule
} from './rules/index.js';

// Utilities for custom rules
export { normalizeTerm } from './utils.js';
