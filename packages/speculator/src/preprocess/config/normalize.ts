/**
 * Config Normalizer
 * 
 * Converts raw document configuration to normalized internal format.
 */

import type { SpecConfig, PersonEntry, MaturityLevel } from '#src/preprocess/types';
import type { ResolvedDocumentConfig, RawRespecConfig, RawBikeshedConfig } from './types.js';

const DATE_PLACEHOLDER = '[DATE]';



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

function normalizeBikeshedConfig(bsRaw: RawBikeshedConfig, config: SpecConfig) {
    const bs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bsRaw)) {
        bs[k.toLowerCase().replace(/[\s!]/g, '')] = v;
    }

    if (bs.ed !== undefined && typeof bs.ed === 'string') {
        config.specIri = bs.ed;
    }
    if (bs.title !== undefined) {
        config.title = bs.title as string;
    }
    if (bs.shortname !== undefined) {
        config.shortName = bs.shortname as string;
    }
    if (bs.status !== undefined) {
        config.status = bs.status as string;
        config.maturityLevel = mapSpecStatusToMaturity(bs.status as string);
    }
    
    const bsCreated = typeof bs.created === 'string' ? bs.created : undefined;
    const creationDate = resolveDatePlaceholder(bsCreated);
    if (creationDate !== undefined) {
        config.creationDate = creationDate;
    }
    
    const bsModified = typeof bs.modified === 'string' ? bs.modified : undefined;
    const bsModificationDate = resolveDatePlaceholder(bsModified);
    if (bsModificationDate !== undefined) {
        config.lastUpdateDate = bsModificationDate;
    }

    if (bs.tr !== undefined) {
        config.latestVersion = bs.tr as string;
    }

    const bsEditors = Array.isArray(bs.editor) ? bs.editor : (bs.editor ? [bs.editor] : undefined);
    if (bsEditors) {
        config.editors = bsEditors;   
    }
    if (bs.abstract !== undefined) {
        config.abstract = bs.abstract as string;
    }

    if (bs.group !== undefined) {
        config.group = bs.group as string;
    }
    
    if (bs.repository !== undefined) {
        config.repository = bs.repository as string;
    }

    if (bs.maxtocdepth !== undefined) {
        config.maxTocLevel = typeof bs.maxtocdepth === 'string' ? parseInt(bs.maxtocdepth, 10) : (bs.maxtocdepth as number);
    }

    if (bs.biblio !== undefined) {
        config.localBiblio = bs.biblio as Record<string, { title: string; url?: string }>;
    }
}

function normalizeRespecConfig(raw: RawRespecConfig, config: SpecConfig) {
    if (raw.thisVersion !== undefined) {
        config.specIri = raw.thisVersion;
    }
    if (raw.title !== undefined) {
        config.title = raw.title;
    }
    if (raw.shortName !== undefined) {
        config.shortName = raw.shortName;
    }
    if (raw.subtitle !== undefined) {
        config.subtitle = raw.subtitle;
    }
    if (raw.specStatus !== undefined) {
        config.status = raw.specStatus;
        const mappedMaturity = mapSpecStatusToMaturity(raw.specStatus);
        if (mappedMaturity) config.maturityLevel = mappedMaturity;
    }
    
    const publishDate = resolveDatePlaceholder(raw.publishDate);
    if (publishDate !== undefined) {
        config.publishDate = publishDate;
    }
    
    const creationDate = resolveDatePlaceholder(raw.creationDate);
    if (creationDate !== undefined) {
        config.creationDate = creationDate;
    }
    
    const respecModificationDate = resolveDatePlaceholder(raw.modificationDate);
    if (respecModificationDate !== undefined) {
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

    if (raw.editors && Array.isArray(raw.editors)) {
        const editors = raw.editors
            .filter((p): p is PersonEntry => p !== null);
        if (editors.length > 0) {
            config.editors = editors;
        }
    }

    if (raw.authors && Array.isArray(raw.authors)) {
        const authors = raw.authors
            .filter((p): p is PersonEntry => p !== null);
        if (authors.length > 0) {
            config.authors = authors;
        }
    }

    if (raw.abstract !== undefined) {
        config.abstract = raw.abstract;
    }

    if (raw.license !== undefined) {
        config.license = raw.license;
    }
    if (raw.copyright !== undefined) {
        config.copyright = raw.copyright;
    }

    if (raw.logos && Array.isArray(raw.logos)) {
        config.logos = raw.logos.map(logo => ({
            src: logo.src,
            alt: logo.alt,
            href: logo.href || logo.url,
        }));
    }

    if (raw.group !== undefined) {
        config.group = raw.group;
    }
    
    if (raw.repository !== undefined) {
        config.repository = raw.repository;
    }

    if (raw.noTOC === true) {
        config.tocEnabled = false;
    }

    if (raw.maxTocLevel !== undefined && typeof raw.maxTocLevel === 'number') {
        config.maxTocLevel = raw.maxTocLevel;
    }

    if (raw.localBiblio !== undefined) {
        config.localBiblio = raw.localBiblio as Record<string, { title: string; url?: string }>;
    }

    if (raw.xref !== undefined) {
        config.xref = raw.xref;
    }
}

/**
 * Normalize a ResolvedDocumentConfig to internal SpecConfig
 * 
 * Priority order (lowest to highest):
 * 1. bikeshed.* OR respec.* 
 * 2. Root-level properties (title, lastUpdateDate, maturityLevel, repository)
 * 3. custom.* - Highest priority, overwrites everything
 * 
 * @param docConfig - Resolved document config with ID
 * @returns Normalized SpecConfig with defaults applied
 */
export function normalizeConfig(docConfig: ResolvedDocumentConfig): SpecConfig {
    const id = docConfig.id;
    const baseUrl = docConfig.baseUrl;

    const config: SpecConfig = {
        id: docConfig.id,
        deps: docConfig.deps,
        specIri: baseUrl !== undefined ? `${baseUrl.replace(/\/$/, '')}/${id}` : id,
        tocEnabled: true,
    };

    if (docConfig.bikeshed) {
        normalizeBikeshedConfig(docConfig.bikeshed, config);
    } else if (docConfig.respec) {
        normalizeRespecConfig(docConfig.respec, config);
    }

    // Root-level overrides
    if (docConfig.title !== undefined) {
        config.title = docConfig.title;
    }
    if (docConfig.maturityLevel !== undefined) {
        config.maturityLevel = docConfig.maturityLevel;
    }
    if (docConfig.lastUpdateDate !== undefined) {
        const rootLastUpdateDate = resolveDatePlaceholder(docConfig.lastUpdateDate);
        if (rootLastUpdateDate !== undefined) {
            config.lastUpdateDate = rootLastUpdateDate;
        }
    }
    if (docConfig.repository !== undefined) {
        config.repository = docConfig.repository;
    }

    // Custom overrides - highest priority, applied last
    if (docConfig.custom !== undefined) {
        config.custom = docConfig.custom;
    }


    return config;
}
