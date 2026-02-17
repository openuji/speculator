/**
 * Configuration loader and parser for speculator-lint
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { LintConfig, RuleConfigValue } from './types.js';

/**
 * Default configuration
 */
export const defaultConfig: LintConfig = {
    rules: {}
};

/**
 * Recommended configuration with all built-in rules enabled
 */
export const recommendedConfig: LintConfig = {
    rules: {
        'workspace/no-redefinition': 'error',
        'workspace/no-reverse-dependency': 'error',
        'document/no-duplicate-definition': 'error',
        'reference/no-ambiguous-reference': 'warning',
        'reference/no-id-reference': 'warning',
        'reference/no-unresolved-reference': 'error',
        'vocab/validate-spec-terms': 'warning',
        'document/require-cop-concept': 'error'
    }
};

/**
 * Load configuration from a file
 * @param configPath Path to config file (relative or absolute)
 * @returns Parsed configuration
 */
export function loadConfig(configPath: string): LintConfig {
    const resolvedPath = resolve(configPath);

    if (!existsSync(resolvedPath)) {
        throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    const content = readFileSync(resolvedPath, 'utf-8');
    const config = JSON.parse(content) as LintConfig;

    return normalizeConfig(config);
}

/**
 * Load configuration from default locations
 * @param cwd Current working directory
 * @returns Configuration or null if not found
 */
export function loadConfigFromDefaults(cwd: string = process.cwd()): LintConfig | null {
    const candidates = [
        '.speculatorlintrc.json',
        '.speculatorlintrc',
        'speculator-lint.config.json'
    ];

    for (const filename of candidates) {
        const path = resolve(cwd, filename);
        if (existsSync(path)) {
            return loadConfig(path);
        }
    }

    return null;
}

/**
 * Normalize configuration to ensure consistency
 */
export function normalizeConfig(config: LintConfig): LintConfig {
    const normalized: LintConfig = {
        ...config,
        rules: { ...config.rules }
    };

    // Handle extends
    if (config.extends) {
        for (const extend of config.extends) {
            if (extend === 'recommended') {
                normalized.rules = {
                    ...recommendedConfig.rules,
                    ...normalized.rules
                };
            }
        }
    }

    return normalized;
}

/**
 * Get the effective severity for a rule
 * @param ruleConfig Rule configuration value
 * @returns Severity or null if disabled
 */
export function getRuleSeverity(ruleConfig: RuleConfigValue | undefined): 'error' | 'warning' | 'info' | null {
    if (!ruleConfig || ruleConfig === 'off') {
        return null;
    }

    if (typeof ruleConfig === 'object' && ruleConfig !== null) {
        return ruleConfig.severity || 'error';
    }

    return ruleConfig;
}

/**
 * Check if a rule is enabled
 */
export function isRuleEnabled(config: LintConfig, ruleName: string): boolean {
    const ruleConfig = config.rules?.[ruleName];
    return getRuleSeverity(ruleConfig) !== null;
}
