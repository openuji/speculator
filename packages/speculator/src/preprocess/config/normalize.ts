/**
 * Config Normalizer
 * 
 * Converts raw document configuration to normalized internal format.
 */

import type { SpecConfig, PersonEntry, MaturityLevel } from '#src/preprocess/types';
import type { ResolvedDocumentConfig, RawPersonEntry } from './types.js';

const DATE_PLACEHOLDER = '[DATE]';

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
        note: raw.note,
        w3cid: raw.w3cid,
    };
}

/**
 * Map respec specStatus to maturity level
 */
function mapSpecStatusToMaturity(specStatus: string): MaturityLevel | undefined {
    const mapping: Record<string, MaturityLevel> = {
        'ED': 'draft',
        'WD': 'draft',
        'FPWD': 'draft',
        'LCWD': 'prerelease',
        'CR': 'prerelease',
        'PR': 'prerelease',
        'REC': 'stable',
        'NOTE': 'stable',
        'unofficial': 'incubating',
        'CG-DRAFT': 'incubating',
        'CG-FINAL': 'stable',
    };
    return mapping[specStatus];
}

function toISODateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function resolveDatePlaceholder(dateValue: string | undefined): string | undefined {
    if (dateValue === undefined) {
        return undefined;
    }
    if (dateValue.trim() !== DATE_PLACEHOLDER) {
        return dateValue;
    }
    return toISODateString(new Date());
}

/**
 * Normalize a ResolvedDocumentConfig to internal SpecConfig
 * 
 * Priority order (lowest to highest):
 * 1. respec.* - ReSpec-compatible fallback settings
 * 2. Root-level properties (title, lastUpdateDate, maturityLevel)
 * 3. custom.* - Highest priority, overwrites everything
 * 
 * @param docConfig - Resolved document config with ID
 * @returns Normalized SpecConfig with defaults applied
 */
export function normalizeConfig(docConfig: ResolvedDocumentConfig): SpecConfig {
    
    const id = docConfig.id;
    
      // baseUrl for assembling thisVersion (defaults to empty string)
    const baseUrl = docConfig.baseUrl;
    
    const raw = docConfig.respec ?? {};
    let thisVersion: string;
    // Priority: root baseUrl > respec.thisVersion > assembled from baseUrl + id
    if (baseUrl !== undefined) {
        thisVersion = `${baseUrl.replace(/\/$/, '')}/${id}`;
    } else if (raw.thisVersion !== undefined) {
        thisVersion = raw.thisVersion;
    } else {
        thisVersion = id;
    }

    const config: SpecConfig = {
        id: docConfig.id,
        deps: docConfig.deps,
        specIri: thisVersion,
    };

    // Document metadata - Priority: root title > respec.title
    if (docConfig.title !== undefined) {
        config.title = docConfig.title;
    } else if (raw.title !== undefined) {
        config.title = raw.title;
    }
    if (raw.shortName !== undefined) {
        config.shortName = raw.shortName;
    }
    if (raw.subtitle !== undefined) {
        config.subtitle = raw.subtitle;
    }

    // Status and versioning - specStatus is preserved as fallback
    if (raw.specStatus !== undefined) {
        config.status = raw.specStatus;
    }

    // Priority: root maturityLevel > mapped respec.specStatus
    if (docConfig.maturityLevel !== undefined) {
        config.maturityLevel = docConfig.maturityLevel;
    } else if (raw.specStatus !== undefined) {
        config.maturityLevel = mapSpecStatusToMaturity(raw.specStatus);
    }
    const publishDate = resolveDatePlaceholder(raw.publishDate);
    if (publishDate !== undefined) {
        config.publishDate = publishDate;
    }
    const creationDate = resolveDatePlaceholder(raw.creationDate);
    if (creationDate !== undefined) {
        config.creationDate = creationDate;
    }
    
    // Priority: root lastUpdateDate > respec.modificationDate
    const rootLastUpdateDate = resolveDatePlaceholder(docConfig.lastUpdateDate);
    const respecModificationDate = resolveDatePlaceholder(raw.modificationDate);
    if (rootLastUpdateDate !== undefined) {
        config.lastUpdateDate = rootLastUpdateDate;
    } else if (respecModificationDate !== undefined) {
        config.lastUpdateDate = respecModificationDate;
    }
    
    if (raw.version !== undefined) {
        config.version = raw.version;
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
    if (raw.copyright !== undefined) {
        config.copyright = raw.copyright;
    }

    // Branding - normalize logo format
    if (raw.logos && Array.isArray(raw.logos)) {
        config.logos = raw.logos.map(logo => ({
            src: logo.src,
            alt: logo.alt,
            href: logo.href || logo.url,
        }));
    }

    // Organization
    if (raw.group !== undefined) {
        config.group = raw.group;
    }
    if (raw.repository !== undefined) {
        config.repository = raw.repository;
    }

    // Structure
    // ReSpec uses noTOC=true to disable, we use tocEnabled=true to enable
    config.tocEnabled = raw.noTOC !== true;

    if (raw.maxTocLevel !== undefined && typeof raw.maxTocLevel === 'number') {
        config.maxTocLevel = raw.maxTocLevel;
    }

    // Bibliography
    if (raw.localBiblio !== undefined) {
        config.localBiblio = raw.localBiblio as Record<string, { title: string; url?: string }>;
    }

    // Custom overrides - highest priority, applied last
    if (docConfig.custom !== undefined) {
        config.custom = docConfig.custom;
    }

    if(docConfig.noConformance || docConfig.respec?.noConformance !== undefined) {
        const noConformance = docConfig.noConformance || docConfig.respec?.noConformance;
        config.noConformance = noConformance;
    }

    // Cross-references
    if (raw.xref !== undefined) {
        config.xref = raw.xref;
    }

    return config;
}
