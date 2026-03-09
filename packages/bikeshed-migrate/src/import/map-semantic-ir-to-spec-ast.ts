import { basename } from 'node:path';
import type {
    Block,
    BlockAlgorithm,
    BlockCodeBlock,
    BlockDefinitionList,
    BlockDomIntro,
    BlockFigure,
    BlockHeading,
    BlockIdl,
    BlockImageAsset,
    BlockList,
    BlockNote,
    BlockParagraph,
    DefinitionListItem,
    Document,
    DocumentMetadata,
    HtmlAttributes,
    ImageAsset,
    Inline,
    InlineCite,
    InlineCode,
    InlineDefinition,
    InlineExternalDfnReference,
    InlineExternalIdlReference,
    InlineHtmlElement,
    InlineImage,
    InlineLink,
    InlineWorkspaceDfnReference,
    InlineWorkspaceIdlReference,
    ListItem,
    ReferenceSource,
    Section,
    SpecConfig,
    SpeculatorASTSchema,
} from '@openuji/speculator';
import type { SpeculatorConfig } from '../build-config.js';
import type {
    DefinitionNode,
    DocumentNode,
    ImageAssetNode,
    LinkRefNode,
    ListItemNode,
    SectionNode,
    SemanticBlockNode,
    SemanticInlineNode,
} from './semantic-ir.js';

const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export type BikeshedMigrateConfig = SpeculatorConfig;

export interface ConversionDiagnostic {
    level: 'info' | 'warning';
    code: string;
    message: string;
    path?: string;
}

export interface MapSemanticIrToSpecAstInput {
    ir: DocumentNode;
    config: BikeshedMigrateConfig;
    sourcePath?: string;
}

export interface MapSemanticIrToSpecAstResult {
    workspace: SpeculatorASTSchema;
    config: SpecConfig;
    diagnostics: ConversionDiagnostic[];
}

interface MapContext {
    diagnostics: ConversionDiagnostic[];
}

interface MapFrame {
    path: string;
}

export function mapSemanticIrToSpecAst(
    input: MapSemanticIrToSpecAstInput,
): MapSemanticIrToSpecAstResult {
    const diagnostics: ConversionDiagnostic[] = [];
    const ctx: MapContext = { diagnostics };

    const config = mapBikeshedConfigToSpecConfig(input.config, input.sourcePath);
    const document = mapDocument(input.ir, config, input.sourcePath, ctx);

    const workspace: SpeculatorASTSchema = {
        type: 'workspace',
        schemaVersion: '1.1.0',
        documents: [document],
    };

    return {
        workspace,
        config,
        diagnostics,
    };
}

function mapDocument(
    ir: DocumentNode,
    config: SpecConfig,
    sourcePath: string | undefined,
    ctx: MapContext,
): Document {
    const children = mapDocumentChildren(ir.children, ctx, { path: 'document.children' });

    const doc: Document = {
        type: 'document',
        id: config.id,
        children,
    };

    const metadata = mapDocumentMetadata(config);
    if (metadata) {
        doc.metadata = metadata;
    }

    if (sourcePath) {
        doc.sourcePos = {
            file: sourcePath,
            line: 1,
            column: 1,
        };
    }

    return doc;
}

function mapDocumentChildren(
    nodes: Array<SectionNode | SemanticBlockNode>,
    ctx: MapContext,
    frame: MapFrame,
): Array<Section | Block> {
    const out: Array<Section | Block> = [];

    for (let idx = 0; idx < nodes.length; idx += 1) {
        const node = nodes[idx];
        const childPath = `${frame.path}[${idx}]`;
        if (node.type === 'Section') {
            out.push(mapSection(node, ctx, { path: childPath }));
            continue;
        }

        out.push(...mapBlockNodeToBlocks(node, ctx, { path: childPath }));
    }

    return out;
}

function mapSection(node: SectionNode, ctx: MapContext, frame: MapFrame): Section {
    const headingChildren = mapInlines(node.heading, ctx, { path: `${frame.path}.heading` });
    const heading: BlockHeading = {
        type: 'heading',
        depth: clampHeadingDepth(node.level),
        children: headingChildren,
    };

    if (node.id) {
        heading.id = node.id;
    }

    const sectionChildren = mapSectionChildren(node.children, ctx, {
        path: `${frame.path}.children`,
    });

    const section: Section = {
        type: 'section',
        children: sectionChildren,
        heading,
    };

    if (node.id) section.id = node.id;
    if (node.number) section.number = node.number;
    if (node.boilerplate) section.boilerplate = node.boilerplate;
    if (node.omitted) section.omitted = true;

    return section;
}

function mapSectionChildren(
    nodes: SemanticBlockNode[],
    ctx: MapContext,
    frame: MapFrame,
): Array<Section | Block> {
    const out: Array<Section | Block> = [];

    for (let idx = 0; idx < nodes.length; idx += 1) {
        const node = nodes[idx];
        const childPath = `${frame.path}[${idx}]`;

        if (node.type === 'Section') {
            out.push(mapSection(node, ctx, { path: childPath }));
            continue;
        }

        out.push(...mapBlockNodeToBlocks(node, ctx, { path: childPath }));
    }

    return out;
}

function mapBlocksInBlockContext(
    nodes: SemanticBlockNode[],
    ctx: MapContext,
    frame: MapFrame,
): Block[] {
    const out: Block[] = [];

    for (let idx = 0; idx < nodes.length; idx += 1) {
        const node = nodes[idx];
        const childPath = `${frame.path}[${idx}]`;

        if (node.type === 'Section') {
            pushDiagnostic(ctx, {
                code: 'SECTION_IN_BLOCK_CONTEXT_FLATTENED',
                level: 'warning',
                message:
                    'Section node appeared in a block-only context. Flattened to heading + block children.',
                path: childPath,
            });
            out.push(...flattenSectionToBlocks(node, ctx, { path: childPath }));
            continue;
        }

        out.push(...mapBlockNodeToBlocks(node, ctx, { path: childPath }));
    }

    return out;
}

function flattenSectionToBlocks(node: SectionNode, ctx: MapContext, frame: MapFrame): Block[] {
    const heading: BlockHeading = {
        type: 'heading',
        depth: clampHeadingDepth(node.level),
        children: mapInlines(node.heading, ctx, { path: `${frame.path}.heading` }),
    };

    if (node.id) {
        heading.id = node.id;
    }

    return [
        heading,
        ...mapBlocksInBlockContext(node.children, ctx, { path: `${frame.path}.children` }),
    ];
}

function mapBlockNodeToBlocks(node: SemanticBlockNode, ctx: MapContext, frame: MapFrame): Block[] {
    switch (node.type) {
        case 'Section':
            pushDiagnostic(ctx, {
                code: 'SECTION_IN_BLOCK_CONTEXT_FLATTENED',
                level: 'warning',
                message:
                    'Section node reached a block mapper. Flattened to heading + block children.',
                path: frame.path,
            });
            return flattenSectionToBlocks(node, ctx, frame);
        case 'Paragraph': {
            const paragraph: BlockParagraph = {
                type: 'paragraph',
                children: mapInlines(node.children, ctx, { path: `${frame.path}.children` }),
            };
            return [paragraph];
        }
        case 'List': {
            const list: BlockList = {
                type: 'list',
                ordered: node.ordered,
                children: node.items.map((item: ListItemNode, idx: number): ListItem => ({
                    type: 'listItem',
                    children: mapBlocksInBlockContext(item.children, ctx, {
                        path: `${frame.path}.items[${idx}].children`,
                    }),
                })),
            };

            if (typeof node.start === 'number') {
                list.start = node.start;
            }

            return [list];
        }
        case 'ListItem': {
            pushDiagnostic(ctx, {
                code: 'STANDALONE_LIST_ITEM_WRAPPED',
                level: 'warning',
                message:
                    'Standalone ListItem encountered outside of List. Wrapped into a single-item unordered list.',
                path: frame.path,
            });

            const list: BlockList = {
                type: 'list',
                ordered: false,
                children: [
                    {
                        type: 'listItem',
                        children: mapBlocksInBlockContext(node.children, ctx, {
                            path: `${frame.path}.children`,
                        }),
                    },
                ],
            };

            return [list];
        }
        case 'DefinitionList': {
            const definitionList: BlockDefinitionList = {
                type: 'definitionList',
                items: node.items.map((item, idx): DefinitionListItem => ({
                    term: mapInlines(item.term, ctx, {
                        path: `${frame.path}.items[${idx}].term`,
                    }),
                    description: mapBlocksInBlockContext(item.description, ctx, {
                        path: `${frame.path}.items[${idx}].description`,
                    }),
                })),
            };
            return [definitionList];
        }
        case 'CodeBlock': {
            const codeBlock: BlockCodeBlock = {
                type: 'codeBlock',
                value: node.value,
                children: [],
            };
            if (node.language) codeBlock.lang = node.language;
            return [codeBlock];
        }
        case 'IdlBlock': {
            const idl: BlockIdl = {
                type: 'idl',
                value: node.value,
                children: mapInlines(node.children, ctx, { path: `${frame.path}.children` }),
            };
            return [idl];
        }
        case 'AlgorithmBlock': {
            const algorithm: BlockAlgorithm = {
                type: 'algorithm',
                children: mapBlocksInBlockContext(node.children, ctx, {
                    path: `${frame.path}.children`,
                }),
            };
            if (node.name) algorithm.name = node.name;
            return [algorithm];
        }
        case 'DomIntroBlock': {
            const domIntro: BlockDomIntro = {
                type: 'domIntro',
                children: mapBlocksInBlockContext(node.children, ctx, {
                    path: `${frame.path}.children`,
                }),
            };
            return [domIntro];
        }
        case 'NoteBlock': {
            const note: BlockNote = {
                type: 'note',
                informative: true,
                noteType: node.noteType,
                children: mapBlocksInBlockContext(node.children, ctx, {
                    path: `${frame.path}.children`,
                }),
            };
            return [note];
        }
        case 'FigureBlock': {
            const figure: BlockFigure = {
                type: 'figure',
                caption: mapInlines(node.caption, ctx, { path: `${frame.path}.caption` }),
                children: mapBlocksInBlockContext(node.children, ctx, {
                    path: `${frame.path}.children`,
                }),
            };
            if (node.id) figure.id = node.id;
            if (node.image) figure.image = mapImageAsset(node.image);
            return [figure];
        }
        case 'ImageAsset': {
            const imageAsset: BlockImageAsset = {
                type: 'imageAsset',
                asset: mapImageAsset(node),
            };
            return [imageAsset];
        }
        default:
            return [];
    }
}

function mapInlines(nodes: SemanticInlineNode[], ctx: MapContext, frame: MapFrame): Inline[] {
    const out: Inline[] = [];

    for (let idx = 0; idx < nodes.length; idx += 1) {
        const node = nodes[idx];
        const mapped = mapInline(node, ctx, { path: `${frame.path}[${idx}]` });
        if (mapped) out.push(mapped);
    }

    return out;
}

function mapInline(node: SemanticInlineNode, ctx: MapContext, frame: MapFrame): Inline | null {
    switch (node.type) {
        case 'Text':
            return {
                type: 'text',
                value: node.value,
            };
        case 'Variable':
            return {
                type: 'variable',
                value: node.value,
            };
        case 'CodeSpan': {
            const code: InlineCode = {
                type: 'inlineCode',
                value: node.value,
            };
            if (node.children && node.children.length > 0) {
                code.children = mapInlines(node.children, ctx, { path: `${frame.path}.children` });
            }
            return code;
        }
        case 'Definition':
            return mapDefinition(node, ctx, frame);
        case 'LinkRef':
            return mapLinkRef(node, ctx, frame);
        case 'ImageInline':
            return mapInlineImage(node.asset);
        default:
            return null;
    }
}

function mapDefinition(node: DefinitionNode, ctx: MapContext, frame: MapFrame): InlineDefinition {
    const children = mapInlines(node.children, ctx, { path: `${frame.path}.children` });
    const definition: InlineDefinition = {
        type: 'definition',
        term: normalizeTerm(inlinesToPlainText(children)),
        children,
    };

    if (node.id) definition.explicitId = node.id;
    if (node.dfnType) definition.dfnType = node.dfnType;

    const forContexts = splitForContexts(node.dfnFor);
    if (forContexts.length > 0) {
        definition.forContexts = forContexts;
    }

    return definition;
}

function mapLinkRef(node: LinkRefNode, ctx: MapContext, frame: MapFrame): Inline {
    const source = mapReferenceSource(node);

    if (node.kind === 'biblio' || node.citationKey || node.citationNormative) {
        const cite = mapLinkRefToCite(node, ctx, frame, source);
        if (cite) {
            return cite;
        }
    }

    if (node.kind === 'dfn' || node.kind === 'idl') {
        const semanticRef = mapSemanticLinkRefToReference(node, ctx, frame, source);
        if (semanticRef) {
            return semanticRef;
        }

        const fallback = mapLinkFallback(node, ctx, frame, source);
        if (fallback) {
            return fallback;
        }

        return {
            type: 'text',
            value: inlinesToPlainText(mapInlines(node.children, ctx, { path: `${frame.path}.children` })),
        };
    }

    const mapped = mapLinkFallback(node, ctx, frame, source);
    if (mapped) {
        return mapped;
    }

    return {
        type: 'text',
        value: '',
    };
}

function mapLinkRefToCite(
    node: LinkRefNode,
    ctx: MapContext,
    frame: MapFrame,
    source: ReferenceSource | undefined,
): InlineCite | null {
    const children = mapInlines(node.children, ctx, { path: `${frame.path}.children` });
    const key =
        node.citationKey ??
        extractCitationKeyFromText(inlinesToPlainText(children)) ??
        extractCitationKeyFromHref(node.href);

    if (!key) {
        pushDiagnostic(ctx, {
            code: 'CITE_KEY_MISSING',
            level: 'warning',
            message: 'Biblio-like LinkRef could not be converted to cite because no key was found.',
            path: frame.path,
        });
        return null;
    }

    const cite: InlineCite = {
        type: 'cite',
        key,
    };

    if (node.citationNormative) {
        cite.kind = 'normative';
        cite.forcedNormative = true;
    }

    if (children.length > 0) {
        cite.children = children;
    }

    const targetId = extractTargetIdFromHref(node.href);
    if (targetId) {
        cite.targetId = targetId;
    }

    if (node.biblioRef?.url) {
        cite.url = node.biblioRef.url;
    } else if (node.href && isExternalHref(node.href)) {
        cite.url = node.href;
    }

    if (source) {
        cite.source = source;
    }

    return cite;
}

function mapSemanticLinkRefToReference(
    node: LinkRefNode,
    ctx: MapContext,
    frame: MapFrame,
    source: ReferenceSource | undefined,
): InlineWorkspaceDfnReference | InlineWorkspaceIdlReference | InlineExternalDfnReference | InlineExternalIdlReference | null {
    const href = node.href?.trim();
    const children = mapInlines(node.children, ctx, { path: `${frame.path}.children` });
    const targetTerm = inferTargetTerm(node, children, href);

    if (!targetTerm) {
        pushDiagnostic(ctx, {
            code: 'REFERENCE_TARGET_TERM_MISSING',
            level: 'warning',
            message: `Could not infer target term for ${node.kind} reference. Falling back to generic link node.`,
            path: frame.path,
        });
        return null;
    }

    const forContexts = splitForContexts(node.dataLinkFor);
    const targetId = extractTargetIdFromHref(href);

    if (href && isExternalHref(href)) {
        const xrefSpec = inferXrefSpecFromHref(href);
        if (!xrefSpec) {
            pushDiagnostic(ctx, {
                code: 'EXTERNAL_REFERENCE_SPEC_UNKNOWN',
                level: 'warning',
                message: `Could not infer xrefSpec for ${node.kind} external reference. Falling back to generic link node.`,
                path: frame.path,
            });
            return null;
        }

        if (node.kind === 'idl') {
            const externalRef: InlineExternalIdlReference = {
                type: 'externalIdlReference',
                targetTerm,
                xrefSpec,
                children,
                url: href,
            };
            if (forContexts.length > 0) externalRef.forContexts = forContexts;
            if (targetId) externalRef.targetId = targetId;
            if (source) externalRef.source = source;
            return externalRef;
        }

        const externalRef: InlineExternalDfnReference = {
            type: 'externalDfnReference',
            targetTerm,
            xrefSpec,
            children,
            url: href,
        };
        if (forContexts.length > 0) externalRef.forContexts = forContexts;
        if (targetId) externalRef.targetId = targetId;
        if (source) externalRef.source = source;
        return externalRef;
    }

    if (node.kind === 'idl') {
        const workspaceRef: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm,
            children,
        };
        if (forContexts.length > 0) workspaceRef.forContexts = forContexts;
        if (targetId) workspaceRef.targetId = targetId;
        if (source) workspaceRef.source = source;
        return workspaceRef;
    }

    const workspaceRef: InlineWorkspaceDfnReference = {
        type: 'workspaceDfnReference',
        targetTerm,
        children,
    };
    if (forContexts.length > 0) workspaceRef.forContexts = forContexts;
    if (targetId) workspaceRef.targetId = targetId;
    if (source) workspaceRef.source = source;
    return workspaceRef;
}

function mapLinkFallback(
    node: LinkRefNode,
    ctx: MapContext,
    frame: MapFrame,
    source: ReferenceSource | undefined,
): InlineLink | InlineHtmlElement | null {
    const href = node.href?.trim();
    const children = mapInlines(node.children, ctx, { path: `${frame.path}.children` });

    if (href) {
        const link: InlineLink = {
            type: 'link',
            url: href,
            children,
        };
        if (source) {
            link.source = source;
        }
        return link;
    }

    const htmlAnchor = createHtmlAnchorInline(node, children);
    if (node.kind === 'unknown') {
        pushDiagnostic(ctx, {
            code: 'UNKNOWN_REFERENCE_WITHOUT_HREF',
            level: 'warning',
            message: 'Unknown reference without href preserved as htmlInlineElement(a).',
            path: frame.path,
        });
    } else {
        pushDiagnostic(ctx, {
            code: 'REFERENCE_WITHOUT_HREF',
            level: 'warning',
            message: `Reference of kind ${node.kind} had no href and was preserved as htmlInlineElement(a).`,
            path: frame.path,
        });
    }

    return htmlAnchor;
}

function createHtmlAnchorInline(node: LinkRefNode, children: Inline[]): InlineHtmlElement {
    const attributes: HtmlAttributes = {};
    if (node.attrs?.id) attributes.id = node.attrs.id;
    if (node.attrs?.dataLinkType) attributes['data-link-type'] = node.attrs.dataLinkType;
    if (node.dataLinkFor) attributes['data-link-for'] = node.dataLinkFor;
    if (node.attrs?.className && node.attrs.className.length > 0) {
        attributes.class = node.attrs.className.join(' ');
    }

    const htmlAnchor: InlineHtmlElement = {
        type: 'htmlInlineElement',
        tagName: 'a',
        children,
    };

    if (Object.keys(attributes).length > 0) {
        htmlAnchor.attributes = attributes;
    }

    return htmlAnchor;
}

function mapInlineImage(asset: ImageAssetNode): InlineImage {
    const image: InlineImage = {
        type: 'image',
        url: asset.srcResolved ?? asset.srcOriginal,
    };

    if (asset.alt) image.alt = asset.alt;
    if (asset.title) image.title = asset.title;
    image.asset = mapImageAsset(asset);

    return image;
}

function mapImageAsset(asset: ImageAssetNode): ImageAsset {
    const mapped: ImageAsset = {
        srcOriginal: asset.srcOriginal,
    };

    if (asset.srcResolved) mapped.srcResolved = asset.srcResolved;
    if (asset.alt) mapped.alt = asset.alt;
    if (asset.title) mapped.title = asset.title;
    if (typeof asset.exists === 'boolean') mapped.exists = asset.exists;
    if (asset.generatedFrom) mapped.generatedFrom = asset.generatedFrom;

    return mapped;
}

function mapReferenceSource(node: LinkRefNode): ReferenceSource | undefined {
    const source: ReferenceSource = {
        kind: node.kind,
    };

    if (node.href) source.href = node.href;
    if (node.attrs?.dataLinkType) source.dataLinkType = node.attrs.dataLinkType;
    if (node.dataLinkFor) source.dataLinkFor = node.dataLinkFor;
    if (node.attrs?.id) source.id = node.attrs.id;
    if (node.attrs?.className && node.attrs.className.length > 0) {
        source.className = node.attrs.className;
    }

    return source;
}

function inferTargetTerm(
    node: LinkRefNode,
    mappedChildren: Inline[],
    href: string | undefined,
): string | undefined {
    const fromChildren = normalizeTerm(inlinesToPlainText(mappedChildren));
    if (fromChildren) return fromChildren;

    if (node.biblioRef) {
        const fromBiblio = normalizeTerm(node.biblioRef.title ?? '');
        if (fromBiblio) return fromBiblio;
    }

    const fromHref = extractTargetIdFromHref(href);
    if (fromHref) {
        const normalizedHrefTerm = normalizeTerm(fromHref);
        if (normalizedHrefTerm) return normalizedHrefTerm;
    }

    return undefined;
}

function inlinesToPlainText(nodes: Inline[]): string {
    return nodes
        .map((node) => {
            switch (node.type) {
                case 'text':
                case 'inlineCode':
                case 'variable':
                    return node.value;
                case 'definition':
                    return node.term;
                case 'workspaceDfnReference':
                case 'workspaceIdlReference':
                case 'workspaceElementReference':
                case 'externalDfnReference':
                case 'externalIdlReference':
                case 'externalElementReference':
                    return node.targetTerm;
                case 'link':
                case 'emphasis':
                case 'strong':
                case 'issue':
                case 'cite':
                case 'htmlInlineElement':
                    return node.children ? inlinesToPlainText(node.children) : '';
                case 'image':
                    return node.alt ?? '';
                case 'sectionReference':
                    return node.children ? inlinesToPlainText(node.children) : node.targetId;
                case 'requirement':
                    return node.keyword;
                default:
                    return '';
            }
        })
        .join('');
}

function extractCitationKeyFromText(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const bracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (bracketMatch) {
        return bracketMatch[1].trim() || undefined;
    }

    const normalized = trimmed.replace(/^!+/, '');
    return normalized || undefined;
}

function extractCitationKeyFromHref(href: string | undefined): string | undefined {
    if (!href) return undefined;
    const targetId = extractTargetIdFromHref(href);
    if (!targetId) return undefined;

    const match = targetId.match(/^biblio-(.+)$/i);
    if (!match) return undefined;

    return match[1].toUpperCase();
}

function extractTargetIdFromHref(href: string | undefined): string | undefined {
    if (!href) return undefined;

    const trimmed = href.trim();
    if (!trimmed) return undefined;

    if (trimmed.startsWith('#')) {
        const hash = trimmed.slice(1);
        return hash.length > 0 ? safeDecode(hash) : undefined;
    }

    if (!isExternalHref(trimmed)) {
        const hashIdx = trimmed.indexOf('#');
        if (hashIdx >= 0 && hashIdx < trimmed.length - 1) {
            return safeDecode(trimmed.slice(hashIdx + 1));
        }
        return undefined;
    }

    try {
        const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
        if (parsed.hash.length > 1) {
            return safeDecode(parsed.hash.slice(1));
        }
    } catch {
        return undefined;
    }

    return undefined;
}

function inferXrefSpecFromHref(href: string): string | undefined {
    if (!isExternalHref(href)) return undefined;

    try {
        const parsed = new URL(href.startsWith('//') ? `https:${href}` : href);
        const host = parsed.hostname.toLowerCase();
        const pathSegments = parsed.pathname.split('/').filter(Boolean);

        if (host.endsWith('.spec.whatwg.org')) {
            return normalizeTerm(host.split('.')[0]);
        }

        if (host === 'www.w3.org' || host === 'w3.org') {
            if (pathSegments[0]?.toLowerCase() === 'tr' && pathSegments[1]) {
                return normalizeTerm(pathSegments[1]);
            }
            return undefined;
        }

        if (host.endsWith('.github.io')) {
            if (pathSegments[0]) {
                return normalizeTerm(pathSegments[0]);
            }
            return undefined;
        }

        if (host === 'www.rfc-editor.org' || host === 'rfc-editor.org') {
            const rfcSegment = pathSegments.find((segment) => /^rfc\d+$/i.test(segment));
            if (rfcSegment) return normalizeTerm(rfcSegment);
            return 'rfc';
        }

        if (host === 'datatracker.ietf.org') {
            const htmlSegment = pathSegments.find((segment) => /^rfc\d+$/i.test(segment));
            if (htmlSegment) return normalizeTerm(htmlSegment);
            return 'ietf';
        }

        if (host === 'tc39.es' && pathSegments[0]) {
            return normalizeTerm(pathSegments[0]);
        }

        return undefined;
    } catch {
        return undefined;
    }
}

function splitForContexts(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((part) => normalizeTerm(part))
        .filter((part) => part.length > 0);
}

function isExternalHref(href: string): boolean {
    if (href.startsWith('//')) return true;
    return URI_SCHEME_RE.test(href);
}

function normalizeTerm(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .normalize('NFKC');
}

function clampHeadingDepth(level: number): 1 | 2 | 3 | 4 | 5 | 6 {
    const rounded = Number.isFinite(level) ? Math.round(level) : 2;
    if (rounded < 1) return 1;
    if (rounded > 6) return 6;
    return rounded as 1 | 2 | 3 | 4 | 5 | 6;
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function pushDiagnostic(ctx: MapContext, diagnostic: ConversionDiagnostic): void {
    ctx.diagnostics.push(diagnostic);
}

function mapDocumentMetadata(config: SpecConfig): DocumentMetadata | undefined {
    const metadata: DocumentMetadata = {};
    let hasMetadata = false;

    if (config.title) {
        metadata.title = config.title;
        hasMetadata = true;
    }
    if (config.shortName) {
        metadata.shortName = config.shortName;
        hasMetadata = true;
    }
    if (config.status) {
        metadata.status = config.status;
        hasMetadata = true;
    }
    if (config.version) {
        metadata.version = config.version;
        hasMetadata = true;
    }
    if (config.editors) {
        metadata.editors = config.editors;
        hasMetadata = true;
    }
    if (config.authors) {
        metadata.authors = config.authors;
        hasMetadata = true;
    }
    if (config.abstract) {
        metadata.abstract = config.abstract;
        hasMetadata = true;
    }
    if (config.maturityLevel) {
        metadata.maturityLevel = config.maturityLevel;
        hasMetadata = true;
    }
    if (config.repository) {
        metadata.repository = typeof config.repository === 'string'
            ? config.repository
            : {
                  url: config.repository.url,
                  branch: config.repository.branch,
                  repoType: config.repository.type,
              };
        hasMetadata = true;
    }
    if (config.group) {
        metadata.group = typeof config.group === 'string'
            ? config.group
            : {
                  name: config.group.name,
                  url: config.group.url,
              };
        hasMetadata = true;
    }
    if (config.copyright) {
        metadata.copyright = config.copyright;
        hasMetadata = true;
    }
    if (config.license) {
        metadata.license = config.license;
        hasMetadata = true;
    }
    if (config.logos) {
        metadata.logos = config.logos;
        hasMetadata = true;
    }
    if (config.custom) {
        metadata.custom = config.custom;
        hasMetadata = true;
    }

    return hasMetadata ? metadata : undefined;
}

function mapBikeshedConfigToSpecConfig(
    input: BikeshedMigrateConfig,
    sourcePath: string | undefined,
): SpecConfig {
    const bikeshed = isRecord(input.bikeshed) ? input.bikeshed : {};

    const title = readString(bikeshed, 'title');
    const shortName = readString(bikeshed, 'shortname');
    const status = readString(bikeshed, 'status');
    const specIri = readString(bikeshed, 'ed');

    const id = shortName ?? slugifyId(title ?? inferFallbackIdFromSourcePath(sourcePath) ?? 'spec');

    const config: SpecConfig = {
        id,
        deps: [],
        specIri: specIri ?? id,
    };

    if (title) config.title = title;
    if (shortName) config.shortName = shortName;
    if (status) config.status = status;

    const group = readString(bikeshed, 'group');
    if (group) config.group = group;

    const repository = readString(bikeshed, 'repository');
    if (repository) config.repository = repository;

    const tr = readString(bikeshed, 'tr');
    if (tr) config.latestVersion = tr;

    const created = readString(bikeshed, 'created');
    if (created) config.creationDate = created;

    const modified = readString(bikeshed, 'modified');
    if (modified) config.lastUpdateDate = modified;

    const maxtocdepth = bikeshed.maxtocdepth;
    if (typeof maxtocdepth === 'number' && Number.isFinite(maxtocdepth)) {
        config.maxTocLevel = maxtocdepth;
    } else if (typeof maxtocdepth === 'string') {
        const parsed = Number.parseInt(maxtocdepth, 10);
        if (Number.isFinite(parsed)) {
            config.maxTocLevel = parsed;
        }
    }

    if (Array.isArray(bikeshed.editor)) {
        config.editors = bikeshed.editor as SpecConfig['editors'];
    }

    if (Array.isArray(bikeshed.author)) {
        config.authors = bikeshed.author as SpecConfig['authors'];
    }

    if (isRecord(bikeshed.biblio)) {
        config.localBiblio = mapLocalBiblio(bikeshed.biblio);
    }

    const custom = isRecord(input.custom) ? input.custom : {};
    if (Object.keys(custom).length > 0) {
        config.custom = { ...custom };
    }

    const copyright = readString(custom, 'copyright');
    if (copyright) {
        config.copyright = copyright;
    }

    const logos = mapCustomLogos(custom);
    if (logos.length > 0) {
        config.logos = logos;
    }

    return config;
}

function mapLocalBiblio(input: Record<string, unknown>): NonNullable<SpecConfig['localBiblio']> {
    const out: NonNullable<SpecConfig['localBiblio']> = {};

    for (const [key, value] of Object.entries(input)) {
        if (!isRecord(value)) continue;

        const title = readString(value, 'title');
        if (!title) continue;

        const entry: NonNullable<SpecConfig['localBiblio']>[string] = { title };

        const url = readString(value, 'url');
        if (url) entry.url = url;

        const authors = readStringArray(value, 'authors');
        if (authors.length > 0) entry.authors = authors;

        const date = readString(value, 'date');
        if (date) entry.date = date;

        const publisher = readString(value, 'publisher');
        if (publisher) entry.publisher = publisher;

        const status = readString(value, 'status');
        if (status) entry.status = status;

        const raw = readString(value, 'raw');
        if (raw) entry.raw = raw;

        out[key] = entry;
    }

    return out;
}

function mapCustomLogos(custom: Record<string, unknown>): Array<{ src: string; alt?: string; href?: string }> {
    const logos: Array<{ src: string; alt?: string; href?: string }> = [];

    const singleLogo = custom.logo;
    if (isRecord(singleLogo)) {
        const mapped = mapLogo(singleLogo);
        if (mapped) logos.push(mapped);
    }

    const logoArray = custom.logos;
    if (Array.isArray(logoArray)) {
        for (const item of logoArray) {
            if (!isRecord(item)) continue;
            const mapped = mapLogo(item);
            if (mapped) logos.push(mapped);
        }
    }

    return logos;
}

function mapLogo(logo: Record<string, unknown>): { src: string; alt?: string; href?: string } | null {
    const src = readString(logo, 'src');
    if (!src) return null;

    const mapped: { src: string; alt?: string; href?: string } = { src };

    const alt = readString(logo, 'alt');
    if (alt) mapped.alt = alt;

    const href = readString(logo, 'href') ?? readString(logo, 'url');
    if (href) mapped.href = href;

    return mapped;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
    const value = record[key];
    if (!Array.isArray(value)) return [];

    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function inferFallbackIdFromSourcePath(sourcePath: string | undefined): string | undefined {
    if (!sourcePath) return undefined;

    const fileName = basename(sourcePath);
    const withoutExt = fileName.replace(/\.[^.]+$/, '');
    const normalized = withoutExt.trim();

    return normalized.length > 0 ? normalized : undefined;
}

function slugifyId(value: string): string {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/["']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');

    return slug || 'spec';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
