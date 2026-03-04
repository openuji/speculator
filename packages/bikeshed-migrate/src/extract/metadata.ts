/**
 * Parse the Bikeshed <pre class='metadata'> block into a structured map.
 *
 * Bikeshed metadata format:
 *   Key: value
 *   Multi-line values are indented with whitespace on continuation lines.
 *   Keys starting with ! are custom metadata (e.g., !Created:).
 *   Repeated keys (Editor:, Former Editor:) accumulate as arrays.
 */

export type MetadataValue = string | string[];
export type MetadataMap = Map<string, MetadataValue>;

/**
 * Extract and strip the <pre class='metadata'> block from raw .bs content.
 * Returns the block content (without the pre tags) and the remaining content.
 */
export function extractMetadataBlock(content: string): { block: string; rest: string } {
    // Match <pre class='metadata'> or <pre class="metadata">
    const metaRe = /<pre\s+class=['"]metadata['"]\s*>([\s\S]*?)<\/pre>/i;
    const match = content.match(metaRe);
    if (!match) {
        return { block: '', rest: content };
    }
    const block = match[1];
    const rest = content.slice(0, match.index) + content.slice((match.index ?? 0) + match[0].length);
    return { block, rest };
}

/**
 * Parse a metadata block string into a MetadataMap.
 * Keys are normalised to lowercase for reliable lookup.
 * Repeated keys (Editor, Former Editor) produce string[] values.
 */
export function parseMetadataBlock(block: string): MetadataMap {
    const map: MetadataMap = new Map();
    const lines = block.split('\n');

    let currentKey: string | null = null;
    let currentValue: string[] = [];

    function flush() {
        if (currentKey === null) return;
        const joined = currentValue.join('\n').trim();
        const existing = map.get(currentKey);
        if (existing === undefined) {
            map.set(currentKey, joined);
        } else if (Array.isArray(existing)) {
            existing.push(joined);
        } else {
            map.set(currentKey, [existing, joined]);
        }
        currentKey = null;
        currentValue = [];
    }

    for (const line of lines) {
        // Continuation line: starts with whitespace
        if (currentKey !== null && /^\s/.test(line)) {
            currentValue.push(line.trim());
            continue;
        }

        // New key:value line
        const kvMatch = line.match(/^(!?[^:]+):\s*(.*)/);
        if (kvMatch) {
            flush();
            // Normalise key: lowercase, trim, remove leading !
            const rawKey = kvMatch[1].trim();
            currentKey = rawKey.toLowerCase().replace(/^!/, '').trim();
            const val = kvMatch[2].trim();
            if (val) {
                currentValue = [val];
            } else {
                currentValue = [];
            }
            continue;
        }

        // Blank line or unrecognised: flush current entry
        if (line.trim() === '') {
            flush();
        }
    }
    flush();

    return map;
}
