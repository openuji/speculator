/**
 * Build a Speculator config.json object from parsed Bikeshed metadata and bibliography.
 */

import type { MetadataMap } from './extract/metadata.js';
import type { BiblioMap } from './extract/biblio.js';
import { parsePersonEntry } from './extract/editor-parser.js';

export interface SpeculatorConfig {
    id: string;
    title?: string;
    noConformance?: boolean;
    respec: RespecConfig;
    custom?: Record<string, unknown>;
}

export interface RespecConfig {
    title?: string;
    shortName?: string;
    specStatus?: string;
    thisVersion?: string;
    latestVersion?: string;
    prevVersion?: string;
    creationDate?: string;
    modificationDate?: string;
    group?: string;
    repository?: string;
    maxTocLevel?: number;
    editors?: PersonEntry[];
    abstract?: string;
    localBiblio?: BiblioMap;
}

export interface PersonEntry {
    name: string;
    url?: string;
    company?: string;
    companyUrl?: string;
}

function getString(map: MetadataMap, key: string): string | undefined {
    const v = map.get(key);
    if (!v) return undefined;
    if (Array.isArray(v)) return v[0];
    return v || undefined;
}

function getAll(map: MetadataMap, key: string): string[] {
    const v = map.get(key);
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return v ? [v] : [];
}

/**
 * Build a Speculator config object from metadata map and bibliography map.
 * @param metadata - Parsed Bikeshed metadata (keys normalised to lowercase)
 * @param biblio   - Parsed Bikeshed bibliography
 * @param idOverride - Optional ID override; defaults to shortname or 'spec'
 */
export function buildConfig(
    metadata: MetadataMap,
    biblio: BiblioMap,
    idOverride?: string
): SpeculatorConfig {
    const shortName = getString(metadata, 'shortname');
    const title = getString(metadata, 'title');
    const id = idOverride ?? shortName ?? 'spec';

    const respec: RespecConfig = {};

    if (title) respec.title = title;
    if (shortName) respec.shortName = shortName;

    const status = getString(metadata, 'status');
    if (status) respec.specStatus = status;

    const ed = getString(metadata, 'ed');
    if (ed) respec.thisVersion = ed;

    const tr = getString(metadata, 'tr');
    if (tr) respec.latestVersion = tr;

    const created = getString(metadata, 'created');
    if (created) respec.creationDate = created;

    const modified = getString(metadata, 'modified');
    if (modified) respec.modificationDate = modified;

    const group = getString(metadata, 'group');
    if (group) respec.group = group;

    const repo = getString(metadata, 'repository');
    if (repo) respec.repository = repo;

    const maxToc = getString(metadata, 'max toc depth');
    if (maxToc) {
        const n = parseInt(maxToc, 10);
        if (!isNaN(n)) respec.maxTocLevel = n;
    }

    // Editors
    const editorStrings = getAll(metadata, 'editor');
    if (editorStrings.length > 0) {
        respec.editors = editorStrings.map(parsePersonEntry);
    }

    // Abstract (may be multi-line joined with spaces)
    const abstract = getString(metadata, 'abstract');
    if (abstract) respec.abstract = abstract;

    // Bibliography
    if (Object.keys(biblio).length > 0) {
        respec.localBiblio = biblio;
    }

    // Build custom block
    const custom: Record<string, unknown> = {};

    // Former editors
    const formerEditors = getAll(metadata, 'former editor');
    if (formerEditors.length > 0) {
        custom.formerEditors = formerEditors.map(parsePersonEntry);
    }

    // Test suite
    const testSuite = getString(metadata, 'test suite');
    if (testSuite) custom.testSuite = testSuite;

    // Boilerplate handling
    let noConformance: boolean | undefined;
    const boilerplate = getString(metadata, 'boilerplate');
    if (boilerplate && boilerplate.toLowerCase().includes('issues-index no')) {
        noConformance = true;
    }

    const config: SpeculatorConfig = {
        id,
        respec,
    };

    if (title) config.title = title;
    if (noConformance) config.noConformance = noConformance;
    if (Object.keys(custom).length > 0) config.custom = custom;

    return config;
}
