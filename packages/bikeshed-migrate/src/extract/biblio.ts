/**
 * Parse and strip the Bikeshed <pre class="biblio"> block.
 *
 * The biblio block contains a JSON object whose keys are citation keys
 * and values are bibliography entries. Bikeshed uses "href" for the URL;
 * Speculator uses "url". All other fields pass through.
 */

export interface BiblioEntry {
    title?: string;
    url?: string;
    authors?: string[];
    date?: string;
    publisher?: string;
    status?: string;
    raw?: string;
}

export type BiblioMap = Record<string, BiblioEntry>;

/**
 * Extract and strip the <pre class="biblio"> block from raw content.
 * Returns the parsed biblio map and the remaining content.
 */
export function extractBiblioBlock(content: string): { biblio: BiblioMap; rest: string } {
    // Allow quoted or unquoted class value: class=biblio, class='biblio', class="biblio"
    const biblioRe = /<pre\s+class=['"]?biblio['"]?\s*>([\s\S]*?)<\/pre>/i;
    const match = content.match(biblioRe);
    if (!match) {
        return { biblio: {}, rest: content };
    }

    const jsonText = match[1].trim();
    const rest = content.slice(0, match.index) + content.slice((match.index ?? 0) + match[0].length);

    let raw: Record<string, Record<string, unknown>>;
    try {
        raw = JSON.parse(jsonText) as Record<string, Record<string, unknown>>;
    } catch {
        // If JSON is invalid, return empty biblio and keep the block in content
        return { biblio: {}, rest: content };
    }

    const biblio: BiblioMap = {};
    for (const [key, entry] of Object.entries(raw)) {
        const mapped: BiblioEntry = {};
        if (typeof entry.title === 'string') mapped.title = entry.title;
        // Bikeshed uses "href", Speculator uses "url"
        if (typeof entry.href === 'string') mapped.url = entry.href;
        else if (typeof entry.url === 'string') mapped.url = entry.url;
        if (Array.isArray(entry.authors)) {
            mapped.authors = entry.authors.filter((a): a is string => typeof a === 'string');
        }
        if (typeof entry.date === 'string') mapped.date = entry.date;
        if (typeof entry.publisher === 'string') mapped.publisher = entry.publisher;
        if (typeof entry.status === 'string') mapped.status = entry.status;
        biblio[key] = mapped;
    }

    return { biblio, rest };
}
