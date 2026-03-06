import { toHtml } from 'hast-util-to-html';
import { fromHtml } from 'hast-util-from-html';
import { DefaultBoilerplateResolver, type BoilerplateResolver } from './boilerplate-resolver.js';
import { parseLogoSlot, type BoilerplateResult } from './boilerplate.js';
import { buildConfig, type SpeculatorConfig } from './build-config.js';
import { extractBikeshedSource } from './extract/source.js';
import type { BiblioMap } from './extract/biblio.js';
import type { MetadataMap } from './extract/metadata.js';
import type { Resource } from './extract/resources.js';
import {
    normalizeBikeshedRegion,
    normalizeSelectedBikeshedRegions,
    snapshotNormalizedRegions,
    type NormalizeBikeshedHtmlOptions,
} from './html/normalize-bikeshed-html.js';
import { parseBikeshedHtml } from './html/parse-bikeshed-html.js';
import {
    selectBikeshedRegions,
    snapshotSelectedRegions,
} from './html/select-bikeshed-regions.js';
import {
    importNormalizedBikeshedHtmlToIr,
    importNormalizedRegionToIr,
} from './import/html-to-ir.js';
import type {
    DocumentNode,
    SectionNode,
    SemanticBlockNode,
    SemanticInlineNode,
    TextNode,
} from './import/semantic-ir.js';
import { DockerBikeshedRenderer } from './renderer/docker.js';
import type {
    BikeshedRenderResult,
    BikeshedRenderer,
    RendererDiagnostic,
    RendererDiagnosticLevel,
} from './renderer/types.js';
import type { Element, ElementContent } from 'hast';

export interface ImportBikeshedSpecOptions extends NormalizeBikeshedHtmlOptions {
    renderer?: BikeshedRenderer;
    renderedHtml?: string;
    sourcePath?: string;
    boilerplateResolver?: BoilerplateResolver;
    resolveBoilerplate?: boolean;
}

export interface ImportDiagnostic {
    stage: 'boilerplate' | 'render' | 'parse' | 'normalize' | 'import';
    level: RendererDiagnosticLevel;
    message: string;
    code?: string;
}

export interface ImportedRegion {
    selectedHtml: string;
    normalizedHtml: string;
    blocks: SemanticBlockNode[];
}

export interface ImportBikeshedSpecResult {
    metadata: MetadataMap;
    biblio: BiblioMap;
    resources: Resource[];
    config: SpeculatorConfig;
    boilerplate: BoilerplateResult;
    renderedHtml: string;
    rendererLogs: string[];
    rendererDiagnostics: RendererDiagnostic[];
    regions: {
        main: {
            selectedHtml: string;
            normalizedHtml: string;
        };
        abstract?: ImportedRegion;
        status?: ImportedRegion;
        conformance?: ImportedRegion;
    };
    document: DocumentNode;
    diagnostics: ImportDiagnostic[];
}

/**
 * New Bikeshed importer pipeline:
 * source extractors -> boilerplate resolver -> renderer -> HTML parse/select/normalize -> semantic IR.
 */
export async function importBikeshedSpec(
    content: string,
    options: ImportBikeshedSpecOptions = {},
): Promise<ImportBikeshedSpecResult> {
    const diagnostics: ImportDiagnostic[] = [];

    const source = extractBikeshedSource(content);
    const { config } = buildConfig(source.metadata, source.biblio);
    const boilerplateMacroValues = buildBoilerplateMacroValues(source.metadata, config);

    const boilerplate = await resolveBoilerplate(source.metadata, options, diagnostics);
    const rendered = await renderBikeshed(content, source.metadata, options);

    diagnostics.push(
        ...rendered.diagnostics.map((d) => ({
            stage: 'render' as const,
            level: d.level,
            message: d.message,
            code: d.code,
        })),
    );

    if (!rendered.html.trim()) {
        const diagnosticSummary = rendered.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join(' | ');
        const suffix = diagnosticSummary ? ` Diagnostics: ${diagnosticSummary}` : '';
        throw new Error(`Bikeshed renderer did not return HTML output.${suffix}`);
    }

    const parsed = parseBikeshedHtml(rendered.html);
    const selected = selectBikeshedRegions(parsed);
    const selectedSnapshot = snapshotSelectedRegions(selected);

    const normalized = normalizeSelectedBikeshedRegions(selected, options);
    const normalizedSnapshot = snapshotNormalizedRegions(normalized);

    let document = importNormalizedBikeshedHtmlToIr(normalized.main);

    const abstract = normalized.abstract
        ? {
              selectedHtml: selectedSnapshot.abstractHtml ?? '',
              normalizedHtml: normalizedSnapshot.abstractHtml ?? '',
              blocks: importNormalizedRegionToIr(normalized.abstract),
          }
        : undefined;

    const status = normalized.status
        ? {
              selectedHtml: selectedSnapshot.statusHtml ?? '',
              normalizedHtml: normalizedSnapshot.statusHtml ?? '',
              blocks: importNormalizedRegionToIr(normalized.status),
          }
        : undefined;

    const abstractBoilerplate = boilerplate.abstract
        ? importBoilerplateRegion(
              boilerplate.abstract.content,
              'abstract',
              'Abstract',
              options,
              boilerplateMacroValues,
          )
        : undefined;

    const sotdBoilerplate = boilerplate.status
        ? importBoilerplateRegion(
              boilerplate.status.content,
              'sotd',
              'Status of This Document',
              options,
              boilerplateMacroValues,
          )
        : undefined;

    const conformance = boilerplate.conformance
        ? importBoilerplateRegion(
              boilerplate.conformance.content,
              'conformance',
              'Conformance',
              options,
              boilerplateMacroValues,
          )
        : undefined;

    enrichConfigFromBoilerplate(config, boilerplate);
    document = injectBoilerplateSections(document, {
        abstract: abstractBoilerplate?.blocks ?? abstract?.blocks,
        sotd: sotdBoilerplate?.blocks ?? status?.blocks,
        conformance: conformance?.blocks,
    });

    return {
        metadata: source.metadata,
        biblio: source.biblio,
        resources: source.resources,
        config,
        boilerplate,
        renderedHtml: rendered.html,
        rendererLogs: rendered.logs,
        rendererDiagnostics: rendered.diagnostics,
        regions: {
            main: {
                selectedHtml: selectedSnapshot.mainHtml,
                normalizedHtml: normalizedSnapshot.mainHtml,
            },
            abstract,
            status,
            conformance,
        },
        document,
        diagnostics,
    };
}

async function resolveBoilerplate(
    metadata: MetadataMap,
    options: ImportBikeshedSpecOptions,
    diagnostics: ImportDiagnostic[],
): Promise<BoilerplateResult> {
    if (options.resolveBoilerplate === false) return {};

    const resolver = options.boilerplateResolver ?? new DefaultBoilerplateResolver();

    try {
        return await resolver.resolve(metadata);
    } catch (error) {
        diagnostics.push({
            stage: 'boilerplate',
            level: 'warning',
            code: 'BOILERPLATE_RESOLUTION_FAILED',
            message: (error as Error).message,
        });
        return {};
    }
}

async function renderBikeshed(
    content: string,
    metadata: MetadataMap,
    options: ImportBikeshedSpecOptions,
): Promise<BikeshedRenderResult> {
    if (options.renderedHtml !== undefined) {
        return {
            html: options.renderedHtml,
            logs: ['Using provided renderedHtml option.'],
            diagnostics: [],
        };
    }

    const renderer = options.renderer ?? new DockerBikeshedRenderer();
    return renderer.render({ bsContent: content, metadata, sourcePath: options.sourcePath });
}

function enrichConfigFromBoilerplate(
    config: SpeculatorConfig,
    boilerplate: BoilerplateResult,
): void {
    config.custom ??= {};

    if (boilerplate.copyright?.content?.trim()) {
        config.custom.copyright = boilerplate.copyright.content.trim();
    }

    if (boilerplate.logo) {
        const logo = parseLogoSlot(boilerplate.logo);
        if (logo) {
            config.custom.logo = logo;
        }
    }
}

function importBoilerplateRegion(
    content: string,
    slot: 'abstract' | 'sotd' | 'conformance',
    fallbackHeading: string,
    options: ImportBikeshedSpecOptions,
    macroValues: Record<string, string>,
): ImportedRegion {
    const resolvedContent = resolveBoilerplateMacros(content, macroValues);
    const wrapper = wrapHtmlInSection(resolvedContent, slot, fallbackHeading);
    const normalizedWrapper = normalizeBikeshedRegion(wrapper, options);
    const normalizedHtml = toHtml(normalizedWrapper, { closeSelfClosing: true }).trim();
    const blocks = importNormalizedRegionToIr(normalizedWrapper);

    return {
        selectedHtml: resolvedContent.trim(),
        normalizedHtml,
        blocks,
    };
}

function buildBoilerplateMacroValues(
    metadata: MetadataMap,
    config: SpeculatorConfig,
): Record<string, string> {
    const abstract =
        getMetadataString(metadata, 'abstract') ?? getBikeshedConfigString(config, 'abstract');
    const statusText =
        getMetadataString(metadata, 'status text') ??
        getMetadataString(metadata, 'statustext') ??
        getBikeshedConfigString(config, 'statustext');
    const title = getBikeshedConfigString(config, 'title') ?? getMetadataString(metadata, 'title');
    const shortname =
        getBikeshedConfigString(config, 'shortname') ??
        getMetadataString(metadata, 'shortname');
    const status =
        getBikeshedConfigString(config, 'status') ?? getMetadataString(metadata, 'status');
    const group = getBikeshedConfigString(config, 'group') ?? getMetadataString(metadata, 'group');

    const values: Record<string, string | undefined> = {
        ABSTRACT: abstract,
        STATUSTEXT: statusText,
        STATUS_TEXT: statusText,
        TITLE: title,
        SHORTNAME: shortname,
        STATUS: status,
        GROUP: group,
    };

    const resolved = Object.entries(values).filter(
        (entry): entry is [string, string] => !!entry[1] && entry[1].trim().length > 0,
    );
    return Object.fromEntries(resolved);
}

function getMetadataString(metadata: MetadataMap, key: string): string | undefined {
    const value = metadata.get(key.toLowerCase());
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return value[0];
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function getBikeshedConfigString(config: SpeculatorConfig, key: string): string | undefined {
    const value = config.bikeshed?.[key];
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function resolveBoilerplateMacros(content: string, macroValues: Record<string, string>): string {
    const replaced = content.replace(
        /\[([A-Z][A-Z0-9_-]*)\]/g,
        (_match, rawName: string) => macroValues[rawName.toUpperCase()] ?? '',
    );
    return cleanupBoilerplateHtml(replaced);
}

function cleanupBoilerplateHtml(html: string): string {
    const emptyTagPatterns = [
        /<p\b[^>]*>\s*<\/p>/gi,
        /<div\b[^>]*>\s*<\/div>/gi,
        /<section\b[^>]*>\s*<\/section>/gi,
        /<span\b[^>]*>\s*<\/span>/gi,
    ];

    let next = html;
    while (true) {
        const current = next;
        for (const pattern of emptyTagPatterns) {
            next = next.replace(pattern, '');
        }
        if (next === current) break;
    }

    return next.replace(/\n{3,}/g, '\n\n').trim();
}

function wrapHtmlInSection(
    html: string,
    slot: 'abstract' | 'sotd' | 'conformance',
    fallbackHeading: string,
): Element {
    const fragment = fromHtml(html, { fragment: true });
    const children: ElementContent[] = fragment.children.filter(
        (node): node is ElementContent => node.type === 'element' || node.type === 'text',
    );

    const onlySectionChild =
        children.length === 1 &&
        children[0].type === 'element' &&
        (children[0] as Element).tagName.toLowerCase() === 'section';

    if (onlySectionChild) {
        const section = children[0] as Element;
        const sectionHasHeading = hasHeadingElement(section.children);
        const nextChildren = sectionHasHeading
            ? section.children
            : [makeHeadingNode(fallbackHeading), ...section.children];

        return {
            ...section,
            properties: {
                ...(section.properties ?? {}),
                dataBoilerplateSlot: slot,
            },
            children: nextChildren,
        };
    }

    if (!hasHeadingElement(children)) {
        children.unshift(makeHeadingNode(fallbackHeading));
    }

    return {
        type: 'element',
        tagName: 'section',
        properties: {
            dataBoilerplateSlot: slot,
        },
        children,
    };
}

function makeHeadingNode(value: string): Element {
    return {
        type: 'element',
        tagName: 'h2',
        properties: {},
        children: [{ type: 'text', value }],
    };
}

function hasHeadingElement(children: ElementContent[]): boolean {
    return children.some(
        (node) =>
            node.type === 'element' && /^h[1-6]$/.test((node as Element).tagName.toLowerCase()),
    );
}

function injectBoilerplateSections(
    document: DocumentNode,
    sections: {
        abstract?: SemanticBlockNode[];
        sotd?: SemanticBlockNode[];
        conformance?: SemanticBlockNode[];
    },
): DocumentNode {
    const nextDocument: DocumentNode = {
        ...document,
        children: [...document.children],
    };

    applyBoilerplateSection(nextDocument, sections.abstract, 'abstract', 'Abstract', 'prepend');
    applyBoilerplateSection(nextDocument, sections.sotd, 'sotd', 'Status of This Document', 'prepend');
    applyBoilerplateSection(nextDocument, sections.conformance, 'conformance', 'Conformance', 'append');

    return nextDocument;
}

function applyBoilerplateSection(
    document: DocumentNode,
    blocks: SemanticBlockNode[] | undefined,
    boilerplate: 'abstract' | 'sotd' | 'conformance',
    fallbackHeading: string,
    placement: 'prepend' | 'append',
): void {
    const section = toBoilerplateSection(blocks, boilerplate, fallbackHeading);
    if (!section) return;

    const existing = findMatchingSection(document.children, section);
    if (existing) {
        existing.boilerplate = boilerplate;
        existing.id = section.id ?? existing.id;
        existing.level = section.level;
        existing.heading = section.heading;
        existing.children = section.children;
        return;
    }

    if (placement === 'prepend') {
        document.children.unshift(section);
        return;
    }

    document.children.push(section);
}

function toBoilerplateSection(
    blocks: SemanticBlockNode[] | undefined,
    boilerplate: 'abstract' | 'sotd' | 'conformance',
    fallbackHeading: string,
): SectionNode | undefined {
    if (!blocks || blocks.length === 0) return undefined;

    const firstSectionIndex = blocks.findIndex((node) => node.type === 'Section');
    if (firstSectionIndex >= 0) {
        const section = blocks[firstSectionIndex] as SectionNode;
        const rest = blocks.filter((_node, idx) => idx !== firstSectionIndex);
        const cloned: SectionNode = {
            ...section,
            boilerplate,
            children: [...section.children, ...rest],
        };
        return cloned;
    }

    const heading: TextNode = { type: 'Text', value: fallbackHeading };
    return {
        type: 'Section',
        level: 2,
        boilerplate,
        heading: [heading],
        children: blocks,
    };
}

function findMatchingSection(
    children: Array<SectionNode | SemanticBlockNode>,
    target: SectionNode,
): SectionNode | undefined {
    const targetId = target.id?.trim();
    const targetHeadingText = inlineText(target.heading).trim().toLowerCase();

    for (const child of children) {
        if (child.type !== 'Section') continue;
        const candidateId = child.id?.trim();
        if (targetId && candidateId && targetId === candidateId) {
            return child;
        }
        if (targetHeadingText.length > 0) {
            const candidateHeadingText = inlineText(child.heading).trim().toLowerCase();
            if (candidateHeadingText === targetHeadingText) {
                return child;
            }
        }
    }

    return undefined;
}

function inlineText(nodes: SemanticInlineNode[]): string {
    return nodes
        .map((node) => {
            if (node.type === 'Text') return node.value;
            if (node.type === 'CodeSpan') return node.value;
            if (node.type === 'Variable') return node.value;
            if (node.type === 'Definition' || node.type === 'LinkRef') {
                return inlineText(node.children);
            }
            return '';
        })
        .join('');
}

export function serializeDocumentIr(document: DocumentNode): string {
    return JSON.stringify(document, null, 2) + '\n';
}

export function serializeNormalizedMainHtml(result: ImportBikeshedSpecResult): string {
    return result.regions.main.normalizedHtml.trim() + '\n';
}

export function serializeNormalizedRegionHtml(region: ImportedRegion): string {
    return region.normalizedHtml.trim() + '\n';
}

export function serializeBlocksIr(blocks: SemanticBlockNode[]): string {
    return JSON.stringify(blocks, null, 2) + '\n';
}

export function serializeElementHtml(html: string): string {
    const parsed = parseBikeshedHtml(html);
    return toHtml(parsed.root, { closeSelfClosing: true }).trim() + '\n';
}
