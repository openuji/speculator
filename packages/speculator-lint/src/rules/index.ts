/**
 * Built-in lint rules
 */

export { noRedefinitionRule } from './workspace/no-redefinition.js';
export { noReverseDependencyRule } from './workspace/no-reverse-dependency.js';
export { noDuplicateDefinitionRule } from './document/no-duplicate-definition.js';
export { noAmbiguousReferenceRule } from './reference/no-ambiguous-reference.js';
export { noIdReferenceRule } from './reference/no-id-reference.js';
export { noUnresolvedReferenceRule } from './reference/no-unresolved-reference.js';
export { validateSpecTermsRule } from './vocab/validate-spec-terms.js';

import { noRedefinitionRule } from './workspace/no-redefinition.js';
import { noReverseDependencyRule } from './workspace/no-reverse-dependency.js';
import { noDuplicateDefinitionRule } from './document/no-duplicate-definition.js';
import { noAmbiguousReferenceRule } from './reference/no-ambiguous-reference.js';
import { noIdReferenceRule } from './reference/no-id-reference.js';
import { noUnresolvedReferenceRule } from './reference/no-unresolved-reference.js';
import { validateSpecTermsRule } from './vocab/validate-spec-terms.js';
import type { LintRule } from '../types.js';

/**
 * All built-in rules
 */
export const builtInRules: LintRule[] = [
    noRedefinitionRule,
    noReverseDependencyRule,
    noDuplicateDefinitionRule,
    noAmbiguousReferenceRule,
    noIdReferenceRule,
    noUnresolvedReferenceRule,
    validateSpecTermsRule
];

/**
 * Get a rule by name
 */
export function getRuleByName(name: string): LintRule | undefined {
    return builtInRules.find(r => r.meta.name === name);
}
