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
    email?: string;
    /** Optional note about the person's role (e.g., "Main Editor") */
    note?: string;
    /** W3C ID if applicable */
    w3cid?: string;
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

    for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        
        // W3C ID: "w3cid 12345"
        if (p.toLowerCase().startsWith('w3cid')) {
            result.w3cid = p.replace(/w3cid\s+/i, '').trim();
            continue;
        }

        // Email: contains @ but not :// (to avoid confusion with URLs)
        if (p.includes('@') && !p.includes('://')) {
            result.email = p;
            continue;
        }

        // URL or Company URL
        if (p.startsWith('http')) {
            // If we don't have a company yet, then this might be a standalone URL or we should check if it's following a company name in the same part (legacy logic check)
            // But usually in comma separated, it's its own part.
            if (!result.url) {
                result.url = p;
            }
            continue;
        }

        // Second part is often company
        if (i === 1 && !result.company) {
            // Check if it's "Company https://url"
            const m = p.match(/^(.+?)\s+(https?:\/\/\S+)$/);
            if (m) {
                result.company = m[1].trim();
                result.companyUrl = m[2].trim();
            } else {
                result.company = p;
            }
            continue;
        }
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
