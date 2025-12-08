/**
 * Normalization Utilities
 * 
 * Shared utilities for term normalization and attribute parsing
 * used by ReSpec-compatible parse plugins.
 */

/**
 * Normalize a term string for matching.
 * 
 * Rules (per ReSpec spec):
 * 1. Lowercase
 * 2. Trim
 * 3. Collapse internal whitespace to single ASCII space
 * 4. Optionally normalize Unicode (NFKC)
 * 
 * Example: "  Event   Loop " → "event loop"
 */
export function normalizeTerm(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .normalize('NFKC');
}

/**
 * Split data-lt attribute value into link texts.
 * 
 * data-lt uses ; or | as separator.
 * Each resulting item is trimmed, empty tokens are discarded.
 */
export function splitLinkTexts(attr: string): string[] {
    return attr
        .split(/[;|]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Split data-dfn-for attribute value into for-contexts.
 * 
 * data-dfn-for uses , as separator.
 * Each resulting item is trimmed, empty tokens are discarded.
 */
export function splitForContexts(attr: string): string[] {
    return attr
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Parse data-cite attribute value.
 * 
 * Syntax: [!]SPEC[/path][#fragment]
 * 
 * Examples:
 * - "HTML#the-a-element" → { specId: "html", fragment: "the-a-element" }
 * - "!RFC2119" → { specId: "rfc2119", forcedNormative: true }
 * - "fetch#concept-request" → { specId: "fetch", fragment: "concept-request" }
 * - "rfc2119/section-2#anchor" → { specId: "rfc2119", path: "section-2", fragment: "anchor" }
 */
export interface DataCiteParsed {
    specId: string;
    path: string | null;
    fragment: string | null;
    forcedNormative: boolean;
}

export function parseDataCite(attr: string): DataCiteParsed {
    let value = attr.trim();
    let forcedNormative = false;

    // Check for leading !
    if (value.startsWith('!')) {
        forcedNormative = true;
        value = value.slice(1);
    }

    // Split by # first to get fragment
    let fragment: string | null = null;
    const hashIdx = value.indexOf('#');
    if (hashIdx !== -1) {
        fragment = value.slice(hashIdx + 1);
        value = value.slice(0, hashIdx);
    }

    // Split by / to get path
    let path: string | null = null;
    const slashIdx = value.indexOf('/');
    if (slashIdx !== -1) {
        path = value.slice(slashIdx + 1);
        value = value.slice(0, slashIdx);
    }

    return {
        specId: normalizeTerm(value),
        path,
        fragment,
        forcedNormative,
    };
}
