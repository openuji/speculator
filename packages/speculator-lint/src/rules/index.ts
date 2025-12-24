/**
 * Built-in lint rules
 */

export { noRedefinitionRule } from './workspace/no-redefinition.js';
export { noReverseDependencyRule } from './workspace/no-reverse-dependency.js';

import { noRedefinitionRule } from './workspace/no-redefinition.js';
import { noReverseDependencyRule } from './workspace/no-reverse-dependency.js';
import type { LintRule } from '../types.js';

/**
 * All built-in rules
 */
export const builtInRules: LintRule[] = [
    noRedefinitionRule,
    noReverseDependencyRule
];

/**
 * Get a rule by name
 */
export function getRuleByName(name: string): LintRule | undefined {
    return builtInRules.find(r => r.meta.name === name);
}
