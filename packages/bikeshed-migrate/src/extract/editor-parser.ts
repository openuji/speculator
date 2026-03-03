/**
 * Parse Bikeshed editor/author string formats:
 *   [Name](url) ([Company](companyUrl))
 *   [Name](url)
 *   Name
 *   Name (Company)
 */

export interface ParsedPerson {
    name: string;
    url?: string;
    company?: string;
    companyUrl?: string;
}

// Matches: [Name](url) ([Company](companyUrl))
const FULL_RE = /^\[([^\]]+)\]\(([^)]+)\)\s+\(\[([^\]]+)\]\(([^)]+)\)\)$/;
// Matches: [Name](url) (Company)
const NAME_URL_COMPANY_RE = /^\[([^\]]+)\]\(([^)]+)\)\s+\(([^)]+)\)$/;
// Matches: [Name](url)
const NAME_URL_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;
// Matches: Name (Company)
const NAME_COMPANY_RE = /^([^([]+)\s+\(([^)]+)\)$/;

export function parsePersonEntry(raw: string): ParsedPerson {
    const s = raw.trim();

    let m: RegExpMatchArray | null;

    m = s.match(FULL_RE);
    if (m) {
        return { name: m[1].trim(), url: m[2].trim(), company: m[3].trim(), companyUrl: m[4].trim() };
    }

    m = s.match(NAME_URL_COMPANY_RE);
    if (m) {
        return { name: m[1].trim(), url: m[2].trim(), company: m[3].trim() };
    }

    m = s.match(NAME_URL_RE);
    if (m) {
        return { name: m[1].trim(), url: m[2].trim() };
    }

    m = s.match(NAME_COMPANY_RE);
    if (m) {
        return { name: m[1].trim(), company: m[2].trim() };
    }

    return { name: s };
}
