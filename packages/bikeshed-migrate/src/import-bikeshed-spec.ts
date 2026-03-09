import { access } from "node:fs/promises";
import { dirname, isAbsolute, resolve as pathResolve } from "node:path";
import { toHtml } from "hast-util-to-html";
import { fromHtml } from "hast-util-from-html";
import {
  DefaultBoilerplateResolver,
  type BoilerplateResolver,
} from "./boilerplate-resolver.js";
import { parseLogoSlot, type BoilerplateResult } from "./boilerplate.js";
import { buildConfig, type SpeculatorConfig } from "./build-config.js";
import { extractBikeshedSource } from "./extract/source.js";
import type { BiblioEntry, BiblioMap } from "./extract/biblio.js";
import type { MetadataMap } from "./extract/metadata.js";
import type { Resource } from "./extract/resources.js";
import {
  normalizeBikeshedRegion,
  normalizeSelectedBikeshedRegions,
  snapshotNormalizedRegions,
  type NormalizeBikeshedHtmlOptions,
} from "./html/normalize-bikeshed-html.js";
import { parseBikeshedHtml } from "./html/parse-bikeshed-html.js";
import {
  selectBikeshedRegions,
  snapshotSelectedRegions,
} from "./html/select-bikeshed-regions.js";
import {
  importNormalizedBikeshedHtmlToIr,
  importNormalizedRegionToIr,
  type HtmlToIrOptions,
} from "./import/html-to-ir.js";
import type {
  DocumentNode,
  ImageAssetNode,
  SectionNode,
  SemanticBlockNode,
  SemanticInlineNode,
  TextNode,
} from "./import/semantic-ir.js";
import { DockerBikeshedRenderer } from "./renderer/docker.js";
import type {
  BikeshedRenderResult,
  BikeshedRenderer,
  RendererDiagnostic,
  RendererDiagnosticLevel,
} from "./renderer/types.js";
import type { Element, ElementContent } from "hast";

export interface ImportBikeshedSpecOptions extends NormalizeBikeshedHtmlOptions {
  renderer?: BikeshedRenderer;
  renderedHtml?: string;
  sourcePath?: string;
  boilerplateResolver?: BoilerplateResolver;
  resolveBoilerplate?: boolean;
}

export interface ImportDiagnostic {
  stage: "boilerplate" | "render" | "parse" | "normalize" | "import";
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
  const boilerplateMacroValues = buildBoilerplateMacroValues(
    source.metadata,
    config,
  );
  const irOptions: HtmlToIrOptions = {
    biblio: aggregateBiblio(config, source.biblio),
  };

  const boilerplate = await resolveBoilerplate(
    source.metadata,
    options,
    diagnostics,
  );
  const rendered = await renderBikeshed(content, source.metadata, options);

  diagnostics.push(
    ...rendered.diagnostics.map((d) => ({
      stage: "render" as const,
      level: d.level,
      message: d.message,
      code: d.code,
    })),
  );

  if (!rendered.html.trim()) {
    const diagnosticSummary = rendered.diagnostics
      .map((diagnostic) => diagnostic.message)
      .join(" | ");
    const suffix = diagnosticSummary
      ? ` Diagnostics: ${diagnosticSummary}`
      : "";
    throw new Error(`Bikeshed renderer did not return HTML output.${suffix}`);
  }

  const parsed = parseBikeshedHtml(rendered.html);
  const selected = selectBikeshedRegions(parsed);
  const selectedSnapshot = snapshotSelectedRegions(selected);

  const normalized = normalizeSelectedBikeshedRegions(selected, options);
  const normalizedSnapshot = snapshotNormalizedRegions(normalized);

  let document = importNormalizedBikeshedHtmlToIr(normalized.main, irOptions);

  const abstract = normalized.abstract
    ? {
        selectedHtml: selectedSnapshot.abstractHtml ?? "",
        normalizedHtml: normalizedSnapshot.abstractHtml ?? "",
        blocks: importNormalizedRegionToIr(normalized.abstract, irOptions),
      }
    : undefined;

  const status = normalized.status
    ? {
        selectedHtml: selectedSnapshot.statusHtml ?? "",
        normalizedHtml: normalizedSnapshot.statusHtml ?? "",
        blocks: importNormalizedRegionToIr(normalized.status, irOptions),
      }
    : undefined;

  const abstractBoilerplate = boilerplate.abstract
    ? importBoilerplateRegion(
        boilerplate.abstract.content,
        "abstract",
        "Abstract",
        options,
        boilerplateMacroValues,
        irOptions,
      )
    : undefined;

  const sotdBoilerplate = boilerplate.status
    ? importBoilerplateRegion(
        boilerplate.status.content,
        "sotd",
        "Status of This Document",
        options,
        boilerplateMacroValues,
        irOptions,
      )
    : undefined;

  const conformance = boilerplate.conformance
    ? importBoilerplateRegion(
        boilerplate.conformance.content,
        "conformance",
        "Conformance",
        options,
        boilerplateMacroValues,
        irOptions,
      )
    : undefined;

  enrichConfigFromBoilerplate(config, boilerplate);
  const omitConformance = isConformanceOmitted(config);
  document = injectBoilerplateSections(document, {
    abstract: abstractBoilerplate?.blocks ?? abstract?.blocks,
    sotd: sotdBoilerplate?.blocks ?? status?.blocks,
    conformance: conformance?.blocks,
    omitConformance,
  });

  const assetResolutionContext = createAssetResolutionContext(
    options.sourcePath,
    diagnostics,
  );
  if (abstract) {
    abstract.blocks = await resolveImageAssetsInBlocks(
      abstract.blocks,
      assetResolutionContext,
    );
  }
  if (status) {
    status.blocks = await resolveImageAssetsInBlocks(
      status.blocks,
      assetResolutionContext,
    );
  }
  if (conformance) {
    conformance.blocks = await resolveImageAssetsInBlocks(
      conformance.blocks,
      assetResolutionContext,
    );
  }
  document = await resolveImageAssetsInDocument(
    document,
    assetResolutionContext,
  );

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

  const resolver =
    options.boilerplateResolver ?? new DefaultBoilerplateResolver();

  try {
    return await resolver.resolve(metadata);
  } catch (error) {
    diagnostics.push({
      stage: "boilerplate",
      level: "warning",
      code: "BOILERPLATE_RESOLUTION_FAILED",
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
      logs: ["Using provided renderedHtml option."],
      diagnostics: [],
    };
  }

  const renderer = options.renderer ?? new DockerBikeshedRenderer();
  return renderer.render({
    bsContent: content,
    metadata,
    sourcePath: options.sourcePath,
  });
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

function aggregateBiblio(
  config: SpeculatorConfig,
  sourceBiblio: BiblioMap,
): BiblioMap {
  const aggregated: BiblioMap = { ...sourceBiblio };
  const configBiblioRaw = (config.bikeshed?.biblio ?? {}) as Record<
    string,
    unknown
  >;

  for (const [key, value] of Object.entries(configBiblioRaw)) {
    if (!value || typeof value !== "object") continue;
    aggregated[key] = value as BiblioEntry;
  }

  return aggregated;
}

function importBoilerplateRegion(
  content: string,
  slot: "abstract" | "sotd" | "conformance",
  fallbackHeading: string,
  options: ImportBikeshedSpecOptions,
  macroValues: Record<string, string>,
  irOptions: HtmlToIrOptions,
): ImportedRegion {
  const resolvedContent = resolveBoilerplateMacros(content, macroValues);
  const wrapper = wrapHtmlInSection(resolvedContent, slot, fallbackHeading);
  const normalizedWrapper = normalizeBikeshedRegion(wrapper, options);
  const normalizedHtml = toHtml(normalizedWrapper, {
    closeSelfClosing: true,
  }).trim();
  const blocks = importNormalizedRegionToIr(normalizedWrapper, irOptions);

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
    getMetadataString(metadata, "abstract") ??
    getBikeshedConfigString(config, "abstract");
  const statusText =
    getMetadataString(metadata, "status text") ??
    getMetadataString(metadata, "statustext") ??
    getBikeshedConfigString(config, "statustext");
  const title =
    getBikeshedConfigString(config, "title") ??
    getMetadataString(metadata, "title");
  const shortname =
    getBikeshedConfigString(config, "shortname") ??
    getMetadataString(metadata, "shortname");
  const status =
    getBikeshedConfigString(config, "status") ??
    getMetadataString(metadata, "status");
  const group =
    getBikeshedConfigString(config, "group") ??
    getMetadataString(metadata, "group");

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
    (entry): entry is [string, string] =>
      !!entry[1] && entry[1].trim().length > 0,
  );
  return Object.fromEntries(resolved);
}

function getMetadataString(
  metadata: MetadataMap,
  key: string,
): string | undefined {
  const value = metadata.get(key.toLowerCase());
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value[0];
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getBikeshedConfigString(
  config: SpeculatorConfig,
  key: string,
): string | undefined {
  const value = config.bikeshed?.[key];
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveBoilerplateMacros(
  content: string,
  macroValues: Record<string, string>,
): string {
  const replaced = content.replace(
    /\[([A-Z][A-Z0-9_-]*)\]/g,
    (_match, rawName: string) => macroValues[rawName.toUpperCase()] ?? "",
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
      next = next.replace(pattern, "");
    }
    if (next === current) break;
  }

  return next.replace(/\n{3,}/g, "\n\n").trim();
}

function wrapHtmlInSection(
  html: string,
  slot: "abstract" | "sotd" | "conformance",
  fallbackHeading: string,
): Element {
  const fragment = fromHtml(html, { fragment: true });
  const children: ElementContent[] = fragment.children.filter(
    (node): node is ElementContent =>
      node.type === "element" || node.type === "text",
  );

  const onlySectionChild =
    children.length === 1 &&
    children[0].type === "element" &&
    (children[0] as Element).tagName.toLowerCase() === "section";

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
    type: "element",
    tagName: "section",
    properties: {
      dataBoilerplateSlot: slot,
    },
    children,
  };
}

function makeHeadingNode(value: string): Element {
  return {
    type: "element",
    tagName: "h2",
    properties: {},
    children: [{ type: "text", value }],
  };
}

function hasHeadingElement(children: ElementContent[]): boolean {
  return children.some(
    (node) =>
      node.type === "element" &&
      /^h[1-6]$/.test((node as Element).tagName.toLowerCase()),
  );
}

function injectBoilerplateSections(
  document: DocumentNode,
  sections: {
    abstract?: SemanticBlockNode[];
    sotd?: SemanticBlockNode[];
    conformance?: SemanticBlockNode[];
    omitConformance?: boolean;
  },
): DocumentNode {
  const nextDocument: DocumentNode = {
    ...document,
    children: [...document.children],
  };

  applyBoilerplateSection(
    nextDocument,
    sections.abstract,
    "abstract",
    "Abstract",
    "prepend",
    false,
  );
  applyBoilerplateSection(
    nextDocument,
    sections.sotd,
    "sotd",
    "Status of This Document",
    "prepend",
    false,
  );
  applyBoilerplateSection(
    nextDocument,
    sections.conformance,
    "conformance",
    "Conformance",
    "append",
    sections.omitConformance === true,
  );

  return nextDocument;
}

function applyBoilerplateSection(
  document: DocumentNode,
  blocks: SemanticBlockNode[] | undefined,
  boilerplate: "abstract" | "sotd" | "conformance",
  fallbackHeading: string,
  placement: "prepend" | "append",
  omitted: boolean,
): void {
  const section = toBoilerplateSection(
    blocks,
    boilerplate,
    fallbackHeading,
    omitted,
  );
  if (!section) return;

  const existing = findMatchingSection(document.children, section);
  if (existing) {
    existing.boilerplate = boilerplate;
    if (omitted) {
      existing.omitted = true;
    } else {
      delete existing.omitted;
    }
    existing.id = section.id ?? existing.id;
    existing.level = section.level;
    if (section.noToc) {
      existing.noToc = true;
    } else {
      delete existing.noToc;
    }
    if (section.noTocCount) {
      existing.noTocCount = true;
    } else {
      delete existing.noTocCount;
    }
    existing.heading = section.heading;
    existing.children = section.children;
    return;
  }

  if (placement === "prepend") {
    document.children.unshift(section);
    return;
  }

  document.children.push(section);
}

function toBoilerplateSection(
  blocks: SemanticBlockNode[] | undefined,
  boilerplate: "abstract" | "sotd" | "conformance",
  fallbackHeading: string,
  omitted: boolean,
): SectionNode | undefined {
  if (!blocks || blocks.length === 0) return undefined;

  const firstSectionIndex = blocks.findIndex((node) => node.type === "Section");
  if (firstSectionIndex >= 0) {
    const section = blocks[firstSectionIndex] as SectionNode;
    const rest = blocks.filter((_node, idx) => idx !== firstSectionIndex);
    const cloned: SectionNode = applyBoilerplateDefaultSectionFlags(
      {
        ...section,
        boilerplate,
        ...(omitted ? { omitted: true } : {}),
        children: [...section.children, ...rest],
      },
      boilerplate,
    );
    return cloned;
  }

  const heading: TextNode = { type: "Text", value: fallbackHeading };
  return applyBoilerplateDefaultSectionFlags(
    {
      type: "Section",
      level: 2,
      boilerplate,
      ...(omitted ? { omitted: true } : {}),
      heading: [heading],
      children: blocks,
    },
    boilerplate,
  );
}

function applyBoilerplateDefaultSectionFlags(
  section: SectionNode,
  boilerplate: "abstract" | "sotd" | "conformance",
): SectionNode {
  if (boilerplate === "abstract" || boilerplate === "sotd") {
    const next: SectionNode = {
      ...section,
      noToc: true,
    };
    if ("noTocCount" in next) {
      delete next.noTocCount;
    }
    return next;
  }

  if (boilerplate === "conformance") {
    return {
      ...section,
      noTocCount: section.noTocCount ?? true,
    };
  }

  return section;
}

function isConformanceOmitted(config: SpeculatorConfig): boolean {
  const boilerplateConfig = config.bikeshed?.boilerplate;
  if (typeof boilerplateConfig !== "string") return false;

  return /\bomit\s+conformance\b/i.test(boilerplateConfig);
}

function findMatchingSection(
  children: Array<SectionNode | SemanticBlockNode>,
  target: SectionNode,
): SectionNode | undefined {
  const targetId = target.id?.trim();
  const targetHeadingText = inlineText(target.heading).trim().toLowerCase();

  for (const child of children) {
    if (child.type !== "Section") continue;
    const candidateId = child.id?.trim();
    if (targetId && candidateId && targetId === candidateId) {
      return child;
    }
    if (targetHeadingText.length > 0) {
      const candidateHeadingText = inlineText(child.heading)
        .trim()
        .toLowerCase();
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
      if (node.type === "Text") return node.value;
      if (node.type === "CodeSpan") return node.value;
      if (node.type === "Variable") return node.value;
      if (node.type === "Definition" || node.type === "LinkRef") {
        return inlineText(node.children);
      }
      return "";
    })
    .join("");
}

interface AssetResolutionContext {
  sourceDir?: string;
  diagnostics: ImportDiagnostic[];
  existenceCache: Map<string, boolean>;
  warnedMissing: Set<string>;
}

function createAssetResolutionContext(
  sourcePath: string | undefined,
  diagnostics: ImportDiagnostic[],
): AssetResolutionContext {
  return {
    sourceDir: sourcePath ? dirname(sourcePath) : undefined,
    diagnostics,
    existenceCache: new Map(),
    warnedMissing: new Set(),
  };
}

async function resolveImageAssetsInDocument(
  document: DocumentNode,
  context: AssetResolutionContext,
): Promise<DocumentNode> {
  for (const child of document.children) {
    await resolveImageAssetsInBlock(child as SemanticBlockNode, context);
  }
  return document;
}

async function resolveImageAssetsInBlocks(
  blocks: SemanticBlockNode[],
  context: AssetResolutionContext,
): Promise<SemanticBlockNode[]> {
  for (const block of blocks) {
    await resolveImageAssetsInBlock(block, context);
  }
  return blocks;
}

async function resolveImageAssetsInBlock(
  block: SemanticBlockNode,
  context: AssetResolutionContext,
): Promise<void> {
  if (block.type === "Section") {
    for (const inline of block.heading) {
      await resolveImageAssetsInInline(inline, context);
    }
    for (const child of block.children) {
      await resolveImageAssetsInBlock(child, context);
    }
    return;
  }

  if (block.type === "Paragraph") {
    for (const inline of block.children) {
      await resolveImageAssetsInInline(inline, context);
    }
    return;
  }

  if (
    block.type === "AlgorithmBlock" ||
    block.type === "DomIntroBlock" ||
    block.type === "NoteBlock"
  ) {
    for (const child of block.children) {
      await resolveImageAssetsInBlock(child, context);
    }
    return;
  }

  if (block.type === "DefinitionList") {
    for (const item of block.items) {
      for (const termInline of item.term) {
        await resolveImageAssetsInInline(termInline, context);
      }
      for (const descriptionBlock of item.description) {
        await resolveImageAssetsInBlock(descriptionBlock, context);
      }
    }
    return;
  }

  if (block.type === "List") {
    for (const item of block.items) {
      for (const child of item.children) {
        await resolveImageAssetsInBlock(child, context);
      }
    }
    return;
  }

  if (block.type === "ListItem") {
    for (const child of block.children) {
      await resolveImageAssetsInBlock(child, context);
    }
    return;
  }

  if (block.type === "FigureBlock") {
    if (block.image) {
      await resolveImageAsset(block.image, context);
    }
    for (const captionInline of block.caption) {
      await resolveImageAssetsInInline(captionInline, context);
    }
    for (const child of block.children) {
      await resolveImageAssetsInBlock(child, context);
    }
    return;
  }

  if (block.type === "ImageAsset") {
    await resolveImageAsset(block, context);
  }
}

async function resolveImageAssetsInInline(
  inline: SemanticInlineNode,
  context: AssetResolutionContext,
): Promise<void> {
  if (inline.type === "Definition" || inline.type === "LinkRef") {
    for (const child of inline.children) {
      await resolveImageAssetsInInline(child, context);
    }
    return;
  }

  if (inline.type === "ImageInline") {
    await resolveImageAsset(inline.asset, context);
  }
}

async function resolveImageAsset(
  asset: ImageAssetNode,
  context: AssetResolutionContext,
): Promise<void> {
  const srcOriginal = asset.srcOriginal.trim();
  if (!isLocalRelativeAssetSource(srcOriginal)) {
    return;
  }

  const lookupSrc = stripQueryAndHash(srcOriginal);
  if (!lookupSrc) {
    return;
  }

  const resolution = resolveAssetSource(lookupSrc);
  asset.srcResolved = resolution.srcResolved;
  if (resolution.generatedFrom) {
    asset.generatedFrom = resolution.generatedFrom;
  }

  if (!context.sourceDir) {
    return;
  }

  const absolutePath = pathResolve(context.sourceDir, resolution.srcResolved);
  let exists = context.existenceCache.get(absolutePath);
  if (exists === undefined) {
    exists = await fileExists(absolutePath);
    context.existenceCache.set(absolutePath, exists);
  }

  asset.exists = exists;
  if (!exists && !context.warnedMissing.has(absolutePath)) {
    context.warnedMissing.add(absolutePath);
    context.diagnostics.push({
      stage: "import",
      level: "warning",
      code: "ASSET_SOURCE_MISSING",
      message: `Image asset source "${srcOriginal}" resolved to "${resolution.srcResolved}" but file was not found.`,
    });
  }
}

function isLocalRelativeAssetSource(src: string): boolean {
  if (!src || src.startsWith("#")) return false;
  if (src.startsWith("//")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src)) return false;
  if (src.startsWith("/")) return false;
  if (isAbsolute(src)) return false;
  return true;
}

function stripQueryAndHash(src: string): string {
  const hashIndex = src.indexOf("#");
  const queryIndex = src.indexOf("?");
  let end = src.length;
  if (queryIndex >= 0) end = Math.min(end, queryIndex);
  if (hashIndex >= 0) end = Math.min(end, hashIndex);
  return src.slice(0, end).trim();
}

function resolveAssetSource(lookupSrc: string): {
  srcResolved: string;
  generatedFrom?: "mermaid-mmd";
} {
  if (/\.mmd\.svg$/i.test(lookupSrc)) {
    return {
      srcResolved: lookupSrc.replace(/\.mmd\.svg$/i, ".mmd"),
      generatedFrom: "mermaid-mmd",
    };
  }
  return { srcResolved: lookupSrc };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function serializeDocumentIr(document: DocumentNode): string {
  return JSON.stringify(document, null, 2) + "\n";
}

export function serializeNormalizedMainHtml(
  result: ImportBikeshedSpecResult,
): string {
  return result.regions.main.normalizedHtml.trim() + "\n";
}

export function serializeNormalizedRegionHtml(region: ImportedRegion): string {
  return region.normalizedHtml.trim() + "\n";
}

export function serializeBlocksIr(blocks: SemanticBlockNode[]): string {
  return JSON.stringify(blocks, null, 2) + "\n";
}

export function serializeElementHtml(html: string): string {
  const parsed = parseBikeshedHtml(html);
  return toHtml(parsed.root, { closeSelfClosing: true }).trim() + "\n";
}
