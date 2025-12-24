/**
 * Utility functions for speculator-lint
 */

/**
 * Normalize a term for consistent lookup
 * Mirrors the logic from @openuji/speculator
 */
export function normalizeTerm(term: string): string {
    return term
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}
