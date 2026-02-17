/**
 * Normative Level Utilities
 * 
 * Centralized logic for RFC 2119 / 8174 keywords and canonical level resolution.
 */

/**
 * Canonical requirement levels used in the AST and JSON-LD.
 */
export type NormativeLevel = 
    | 'MUST' 
    | 'MUST NOT' 
    | 'SHOULD' 
    | 'SHOULD NOT' 
    | 'MAY' 
    | 'NOTE' 
    | 'NONE' 
    | 'AMBIGUOUS';

/**
 * RFC 2119 / 8174 keywords including aliases.
 */
export type NormativeKeyword =
    | 'MUST'
    | 'MUST NOT'
    | 'REQUIRED'
    | 'SHALL'
    | 'SHALL NOT'
    | 'SHOULD'
    | 'SHOULD NOT'
    | 'RECOMMENDED'
    | 'MAY'
    | 'OPTIONAL';

/**
 * Map of keyword aliases to their canonical normative levels.
 */
export const NORMATIVE_KEYWORDS: Record<string, NormativeLevel> = {
    'MUST': 'MUST',
    'REQUIRED': 'MUST',
    'SHALL': 'MUST',
    'MUST NOT': 'MUST NOT',
    'SHALL NOT': 'MUST NOT',
    'SHOULD': 'SHOULD',
    'RECOMMENDED': 'SHOULD',
    'SHOULD NOT': 'SHOULD NOT',
    'MAY': 'MAY',
    'OPTIONAL': 'MAY'
};

/**
 * Set of levels that represent normative requirements.
 */
export const NORMATIVE_REQUIREMENT_LEVELS = new Set<NormativeLevel>([
    'MUST',
    'MUST NOT',
    'SHOULD',
    'SHOULD NOT',
    'MAY'
]);

/**
 * Checks if a level string is a normative requirement level.
 */
export function isRequirement(level: string): level is NormativeLevel {
    return NORMATIVE_REQUIREMENT_LEVELS.has(level as NormativeLevel);
}

/**
 * Infer requirement level from text content.
 * Policy A: Ambiguous if multiple different levels are found.
 */
export function inferLevel(text: string): NormativeLevel {
    const foundLevels = new Set<NormativeLevel>();
    const upperText = text.toUpperCase();

    // Check negated forms first
    if (/\b(MUST NOT|SHALL NOT)\b/.test(upperText)) foundLevels.add('MUST NOT');
    if (/\bSHOULD NOT\b/.test(upperText)) foundLevels.add('SHOULD NOT');

    // Check positive forms
    // Note: we check if they are NOT followed by NOT to avoid double matching
    if (/\b(MUST|SHALL)\b/.test(upperText) && !/\b(MUST|SHALL) NOT\b/.test(upperText)) {
        foundLevels.add('MUST');
    }
    if (/\b(SHOULD)\b/.test(upperText) && !/\bSHOULD NOT\b/.test(upperText)) {
        foundLevels.add('SHOULD');
    }
    if (/\b(MAY)\b/.test(upperText)) {
        foundLevels.add('MAY');
    }

    if (foundLevels.size === 0) return 'NONE';
    if (foundLevels.size > 1) return 'AMBIGUOUS';

    return Array.from(foundLevels)[0];
}
