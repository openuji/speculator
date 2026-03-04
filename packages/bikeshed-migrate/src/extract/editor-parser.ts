/**
 * Parse Bikeshed editor/author string formats:
 *   [Name](url) ([Company](companyUrl))
 *   [Name](url)
 *   Name
 *   Name (Company)
 *   Name, Company URL, email, w3cid N   (comma-separated Bikeshed style)
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

/**
 * Parse comma-separated Bikeshed editor format:
 *   "Name, Company URL, email, w3cid N"
 * Returns null if the string doesn't look like this format.
 */
function parseCommaSeparated(s: string): ParsedPerson | null {
    if (!s.includes(',')) return null;
    const parts = s.split(',').map(p => p.trim()).filter(Boolean);
    const name = parts[0];
    if (!name) return null;

    const result: ParsedPerson = { name };

    // Second part: "Company https://url" or just "Company"
    if (parts[1]) {
        const m = parts[1].match(/^(.+?)\s+(https?:\/\/\S+)$/);
        if (m) {
            result.company = m[1].trim();
            result.companyUrl = m[2].trim();
        } else {
            result.company = parts[1];
        }
    }

    // Remaining parts: take first non-w3cid value as person URL/email
    for (let i = 2; i < parts.length; i++) {
        if (parts[i].startsWith('w3cid')) continue;
        result.url = parts[i];
        break;
    }

    return result;
}

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

    return parseCommaSeparated(s) ?? { name: s };
}
