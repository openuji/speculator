import { toHtml } from 'hast-util-to-html';
import { DefaultBoilerplateResolver, type BoilerplateResolver } from './boilerplate-resolver.js';
import type { BoilerplateResult } from './boilerplate.js';
import { buildConfig, type SpeculatorConfig } from './build-config.js';
import { extractBikeshedSource } from './extract/source.js';
import type { BiblioMap } from './extract/biblio.js';
import type { MetadataMap } from './extract/metadata.js';
import type { Resource } from './extract/resources.js';
import {
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
import type { DocumentNode, SemanticBlockNode } from './import/semantic-ir.js';
import { DockerBikeshedRenderer } from './renderer/docker.js';
import type {
    BikeshedRenderResult,
    BikeshedRenderer,
    RendererDiagnostic,
    RendererDiagnosticLevel,
} from './renderer/types.js';

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

    const document = importNormalizedBikeshedHtmlToIr(normalized.main);

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
