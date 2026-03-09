import type { SpecConfig } from '@openuji/speculator';

const ROOT_KEY_ORDER: readonly string[] = [
    'id',
    'deps',
    'specIri',
    'title',
    'shortName',
    'subtitle',
    'status',
    'maturityLevel',
    'publishDate',
    'creationDate',
    'lastUpdateDate',
    'version',
    'baseUrl',
    'latestVersion',
    'previousVersion',
    'repository',
    'group',
    'editors',
    'authors',
    'abstract',
    'copyright',
    'license',
    'logos',
    'tocEnabled',
    'maxTocLevel',
    'specProfile',
    'localBiblio',
    'jsonLd',
    'xref',
    'custom',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sortObjectKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => sortObjectKeys(item));
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const sortedEntries = Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entryValue]) => [key, sortObjectKeys(entryValue)] as const);

    return Object.fromEntries(sortedEntries);
}

function normalizeRootConfig(config: SpecConfig): Record<string, unknown> {
    const normalized = sortObjectKeys(config) as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};

    for (const key of ROOT_KEY_ORDER) {
        if (key in normalized) {
            ordered[key] = normalized[key];
        }
    }

    for (const [key, value] of Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))) {
        if (!(key in ordered)) {
            ordered[key] = value;
        }
    }

    return ordered;
}

export function emitCanonicalConfigJson(config: SpecConfig, trailingNewline = true): string {
    const ordered = normalizeRootConfig(config);
    const json = JSON.stringify(ordered, null, 2);
    return trailingNewline ? `${json}\n` : json;
}
