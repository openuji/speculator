/**
 * Build a Speculator config.json object from parsed Bikeshed metadata and bibliography.
 */

import type { MetadataMap } from './extract/metadata.js';
import type { BiblioMap } from './extract/biblio.js';

import { parsePersonEntry } from './extract/editor-parser.js';

type RawBikeshedConfig = {
    shortname?: string;
    status?: string;
    group?: string;
    [key: string]: unknown;
};
export interface SpeculatorConfig {
    bikeshed?: RawBikeshedConfig;
    custom: Record<string, unknown>;
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
 */
export interface BuildConfigResult {
    config: SpeculatorConfig;
    /** Raw abstract text (for includes/abstract.md); not stored in config.json */
    abstract?: string;
    /** Status Text: value; replaces [STATUSTEXT] in includes/status.md */
    statusText?: string;
}

export function buildConfig(
    metadata: MetadataMap,
    biblio: BiblioMap,
): BuildConfigResult {
    
    const bikeshed: RawBikeshedConfig = {
        'modified': '[DATE]',
    };

    const config: SpeculatorConfig = {
        bikeshed,
        custom: {}
    };


    // Map bikeshed metadata directly, replacing spaces/symbols
    for (const k of metadata.keys()) {
        const key = k.toLowerCase().replace(/[\s!]/g, '');
        // Abstract and Status Text are handled separately for includes
        if (key === 'abstract' || key === 'statustext') {
            continue;
        }
        
        // Ensure arrays for people
        if (key === 'editor' || key === 'author') {
             const arr = getAll(metadata, k).map(parsePersonEntry);
             if (arr.length > 0) (bikeshed)[key] = arr;
        }else if (key === 'formereditor' || key === 'formerauthor') {
             const arr = getAll(metadata, k).map(parsePersonEntry);
             if (arr.length > 0) (config.custom)[key] = arr;
        }else if (key.toLocaleLowerCase() === 'url') {
             const str = getString(metadata, k);
             if (str !== undefined) (bikeshed)['ed'] = str;
        }else if (key.toLocaleLowerCase() === 'repository') {
             let str = getString(metadata, k);
             if (str !== undefined) {
                 if (!str.startsWith('https://')) {
                     str = 'https://github.com/' + str;
                 }
                (bikeshed)[key] = str;
             }
        }else {
             const str = getString(metadata, k);
             if (str !== undefined) (bikeshed)[key] = str;
        }
    }

    // Bibliography
    if (Object.keys(biblio).length > 0) {
        (bikeshed).biblio = biblio;
    }


    if (Object.keys(bikeshed).length > 0) {
        config.bikeshed = bikeshed;
    }



    const abstract = getString(metadata, 'abstract') || undefined;
    const statusText = getString(metadata, 'status text') || undefined;

    return { config, abstract, statusText };
}
