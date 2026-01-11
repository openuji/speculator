/**
 * ReSpec Config Normalizer
 * 
 * Converts raw ReSpec configuration to normalized internal format.
 */

import type { SpecConfig, PersonEntry } from '#src/preprocess/types';
import type { RawRespecConfig, RawPersonEntry } from '#src/preprocess/config/loader';

/**
 * Normalize a raw person entry to internal format
 */
function normalizePerson(raw: RawPersonEntry): PersonEntry | null {
    // Name is required
    if (!raw.name) {
        return null;
    }

    return {
        name: raw.name,
        url: raw.url,
        company: raw.company,
        companyURL: raw.companyURL,
        email: raw.mailto || raw.email,
    };
}

/**
 * Normalize raw ReSpec config to internal SpecConfig
 * 
 * @param raw - Raw config from file
 * @param rootLastUpdateDate - Optional root-level lastUpdateDate (takes priority over respec.modificationDate)
 * @returns Normalized SpecConfig with defaults applied
 */
export function normalizeRespecConfig(raw: RawRespecConfig, rootLastUpdateDate?: string): SpecConfig {
    const config: SpecConfig = {};

    // Document metadata
    if (raw.title !== undefined) {
        config.title = raw.title;
    }
    if (raw.shortName !== undefined) {
        config.shortName = raw.shortName;
    }
    if (raw.subtitle !== undefined) {
        config.subtitle = raw.subtitle;
    }

    // Status and versioning
    if (raw.specStatus !== undefined) {
        config.status = raw.specStatus;
    }
    if (raw.publishDate !== undefined) {
        config.publishDate = raw.publishDate;
    }
    
    // Priority: root lastUpdateDate > respec.modificationDate
    if (rootLastUpdateDate !== undefined) {
        config.lastUpdateDate = rootLastUpdateDate;
    } else if (raw.modificationDate !== undefined) {
        config.lastUpdateDate = raw.modificationDate;
    }
    
    if (raw.thisVersion !== undefined) {
        config.thisVersion = raw.thisVersion;
    }
    if (raw.latestVersion !== undefined) {
        config.latestVersion = raw.latestVersion;
    }
    if (raw.prevVersion !== undefined) {
        config.previousVersion = raw.prevVersion;
    }

    // People
    if (raw.editors && Array.isArray(raw.editors)) {
        const editors = raw.editors
            .map(normalizePerson)
            .filter((p): p is PersonEntry => p !== null);
        if (editors.length > 0) {
            config.editors = editors;
        }
    }

    if (raw.authors && Array.isArray(raw.authors)) {
        const authors = raw.authors
            .map(normalizePerson)
            .filter((p): p is PersonEntry => p !== null);
        if (authors.length > 0) {
            config.authors = authors;
        }
    }

    // Content
    if (raw.abstract !== undefined) {
        config.abstract = raw.abstract;
    }

    // Legal
    if (raw.license !== undefined) {
        config.license = raw.license;
    }

    // Branding - normalize logo format
    if (raw.logos && Array.isArray(raw.logos)) {
        config.logos = raw.logos.map(logo => ({
            src: logo.src,
            alt: logo.alt,
            href: logo.href || logo.url,
        }));
    }

    // Structure
    // ReSpec uses noTOC=true to disable, we use tocEnabled=true to enable
    config.tocEnabled = raw.noTOC !== true;

    if (raw.maxTocLevel !== undefined && typeof raw.maxTocLevel === 'number') {
        config.maxTocLevel = raw.maxTocLevel;
    }

    // Bibliography
    if (raw.localBiblio !== undefined) {
        config.localBiblio = raw.localBiblio as any;
    }

    return config;
}

/**
 * Create a default empty config
 */
export function createDefaultConfig(): SpecConfig {
    return {
        tocEnabled: true,
        maxTocLevel: 4,
    };
}
