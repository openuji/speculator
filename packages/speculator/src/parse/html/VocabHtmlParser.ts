/**
 * Vocab HTML Parser
 *
 * Handles <spec-vocab> custom elements.
 * Reads pre-loaded sibling metadata from `unit.sideFiles` (populated at preprocess time)
 * to generate normative prose (Tables, Statements) from vocabulary files.
 *
 * This parser is fully isomorphic — it does NOT access the filesystem directly.
 */

import * as N3 from 'n3';
import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { Block, TableRow, TableCell, SourcePos } from '#src/types/ast.generated';

type SideFileEntry = {
    path: string;
    normalizedPath: string;
    fileName: string;
    content: string;
};

type NormalizeContextOptions = {
    maxImportDepth?: number;
    contextPath?: string;
};

type ImportedContextMatch = {
    id: string;
    path: string;
    contextNode: unknown;
};

type ParsedRdfBundle = {
    store: N3.Store;
    prefixes: Record<string, string>;
};

type SpecTargetKind = 'class' | 'property';

type SpecTargetRequest = {
    kind: SpecTargetKind;
    value: string;
    source: 'term' | 'classIri' | 'property' | 'class';
};

type PropertyCardinality = {
    min?: number;
    max?: number;
};

type PropertyCardinalitySummary = {
    cardinality: PropertyCardinality | null;
    contributingShapeCount: number;
    hasConflict: boolean;
};

type ClassPropertyModel = {
    iri: string;
    name: string;
    label?: string;
    comment?: string;
    valueType: string;
    cardinality: PropertyCardinalitySummary;
};

type ShaclClassPropertyConstraints = {
    cardinality: PropertyCardinality | null;
    contributingShapeCount: number;
    valueTypes: string[];
};

const CONTEXT_FILE_SUFFIX = '.context.jsonld';
const DEFAULT_CONTEXT_IMPORT_MAX_DEPTH = 20;

export const VocabHtmlParser: HtmlParserModule = {
    name: 'VocabHtmlParser',
    handles: ['spec-vocab'],
    order: 4,

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const sourcePos = ctx.createSourcePos(element);
        const sideFiles = ctx.unit.sideFiles;
        if (!sideFiles || Object.keys(sideFiles).length === 0) return null;

        const sideFileEntries = toOrderedSideFileEntries(sideFiles);

        const expandedIriAttr = ctx.getAttr(element, 'data-expanded-iri');
        const showExpandedIri = expandedIriAttr === 'data-expanded-iri' || expandedIriAttr === 'true';

        const explicitTarget = getExplicitTargetRequest(element, ctx);
        const contextAttr = ctx.getAttr(element, 'context');
        if (explicitTarget) {
            return resolveTermRequest(explicitTarget, sideFileEntries, ctx, sourcePos);
        }

        if (contextAttr !== undefined) {
            return resolveContextRequest(contextAttr, sideFileEntries, ctx.unit.file, sourcePos, sideFiles, showExpandedIri);
        }

        const classFallbackTarget = getClassFallbackTargetRequest(element, ctx);
        if (classFallbackTarget) {
            return resolveTermRequest(classFallbackTarget, sideFileEntries, ctx, sourcePos);
        }

        return null;
    }
};

function resolveTermRequest(
    request: SpecTargetRequest,
    sideFiles: SideFileEntry[],
    ctx: ParseContext,
    sourcePos: SourcePos
): BlockHandlerResult {
    const term = request.value;
    const ttlFiles = sideFiles.filter((entry) => entry.fileName.endsWith('.ttl'));
    if (ttlFiles.length > 0) {
        const bundle = buildMergedTtlBundle(ttlFiles);
        if (bundle) {
            const termIri = resolveTermIri(term, bundle.prefixes, bundle.store);
            if (termIri) {
                if (request.kind === 'class') {
                    return generateClassProse(termIri, bundle.store, ctx, sourcePos);
                }
                return generatePropertyProse(termIri, bundle.store, sourcePos);
            }
        }
    }

    const jsonLdFiles = sideFiles.filter(
        (entry) => entry.fileName.endsWith('.jsonld') && !entry.fileName.endsWith(CONTEXT_FILE_SUFFIX)
    );
    for (const jsonLdFile of jsonLdFiles) {
        const result = parseJsonLd(jsonLdFile.content, request, sourcePos);
        if (result) return result;
    }

    return null;
}

function resolveContextRequest(
    contextAttr: string,
    sideFiles: SideFileEntry[],
    unitFile: string,
    sourcePos: SourcePos,
    rawSideFiles: Record<string, string>,
    showExpandedIri: boolean
): BlockHandlerResult {
    const normalizedContextAttr = contextAttr.trim();
    const isDefault = normalizedContextAttr === 'context' || normalizedContextAttr === '';
    const contextFiles = sideFiles.filter((entry) => entry.fileName.endsWith(CONTEXT_FILE_SUFFIX));
    if (contextFiles.length === 0) return null;

    if (isDefault) {
        const folderName = getParentFolderName(unitFile);
        if (folderName) {
            const defaultContextFile = `${folderName}${CONTEXT_FILE_SUFFIX}`;
            const matched = contextFiles.find((entry) => entry.fileName === defaultContextFile);
            if (matched) {
                return parseContextJsonLd(matched.content, folderName, sourcePos, rawSideFiles, matched.normalizedPath, showExpandedIri);
            }
        }

        if (contextFiles.length === 1) {
            const onlyContext = contextFiles[0];
            const fallbackName = stripContextFileSuffix(onlyContext.fileName) || folderName || 'default';
            return parseContextJsonLd(
                onlyContext.content,
                fallbackName,
                sourcePos,
                rawSideFiles,
                onlyContext.normalizedPath,
                showExpandedIri
            );
        }

        return null;
    }

    const contextFileName = normalizedContextAttr.endsWith(CONTEXT_FILE_SUFFIX)
        ? normalizedContextAttr
        : `${normalizedContextAttr}${CONTEXT_FILE_SUFFIX}`;
    const matched = contextFiles.find((entry) => entry.fileName === contextFileName);
    if (!matched) return null;

    const contextName = stripContextFileSuffix(matched.fileName) || normalizedContextAttr;
    return parseContextJsonLd(matched.content, contextName, sourcePos, rawSideFiles, matched.normalizedPath, showExpandedIri);
}

function getExplicitTargetRequest(element: Element, ctx: ParseContext): SpecTargetRequest | null {
    const explicitTerm = normalizeAttrValue(ctx.getAttr(element, 'term'));
    if (explicitTerm) {
        return { kind: 'class', value: explicitTerm, source: 'term' };
    }

    const classIri = normalizeAttrValue(
        ctx.getAttr(element, 'classIri') ?? ctx.getAttr(element, 'class-iri') ?? ctx.getAttr(element, 'classiri')
    );
    if (classIri) {
        return { kind: 'class', value: classIri, source: 'classIri' };
    }

    const propertyValue = ctx.getAttr(element, 'property');
    const normalizedProperty = normalizeAttrValue(propertyValue);
    if (normalizedProperty) {
        return { kind: 'property', value: normalizedProperty, source: 'property' };
    }

    return null;
}

function getClassFallbackTargetRequest(element: Element, ctx: ParseContext): SpecTargetRequest | null {
    const classValue = ctx.getAttr(element, 'class') ?? ctx.getAttr(element, 'className');
    const classTerm = getFallbackClassTerm(classValue);
    if (!classTerm) return null;
    return { kind: 'class', value: classTerm, source: 'class' };
}

function normalizeAttrValue(rawValue: string | undefined): string | undefined {
    if (!rawValue) return undefined;
    const normalized = rawValue.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function getFallbackClassTerm(rawValue: string | undefined): string | undefined {
    if (!rawValue) return undefined;
    const tokens = rawValue
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
    if (tokens.length === 0) return undefined;

    const likelyTermToken = tokens.find(isLikelyTermToken);
    if (likelyTermToken) return likelyTermToken;

    return tokens.length === 1 ? tokens[0] : undefined;
}

function isLikelyTermToken(token: string): boolean {
    return token.includes(':') || token.startsWith('http://') || token.startsWith('https://');
}

function toOrderedSideFileEntries(sideFiles: Record<string, string>): SideFileEntry[] {
    return Object.entries(sideFiles)
        .map(([path, content]) => ({
            path,
            normalizedPath: normalizePath(path),
            fileName: getFileName(path),
            content,
        }))
        .sort((a, b) => a.normalizedPath.localeCompare(b.normalizedPath));
}

function normalizePath(path: string): string {
    const slashNormalized = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (slashNormalized.length > 1 && slashNormalized.endsWith('/')) {
        return slashNormalized.slice(0, -1);
    }
    return slashNormalized;
}

function getFileName(path: string): string {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) return normalized;
    return normalized.slice(lastSlash + 1);
}

function getParentFolderName(path: string | undefined): string {
    if (!path) return '';
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) return '';
    const parentPath = normalized.slice(0, lastSlash);
    const parentLastSlash = parentPath.lastIndexOf('/');
    if (parentLastSlash === -1) return parentPath;
    return parentPath.slice(parentLastSlash + 1);
}

function stripContextFileSuffix(fileName: string): string {
    if (fileName.endsWith(CONTEXT_FILE_SUFFIX)) {
        return fileName.slice(0, -CONTEXT_FILE_SUFFIX.length);
    }
    return fileName;
}

// ============================================================================
// TTL Parsing
// ============================================================================

function buildMergedTtlBundle(ttlFiles: SideFileEntry[]): ParsedRdfBundle | null {
    const store = new N3.Store();
    const prefixes: Record<string, string> = {};

    let parsedAtLeastOneFile = false;
    for (const ttlFile of ttlFiles) {
        try {
            const parser = new N3.Parser();
            const quads = parser.parse(ttlFile.content, null, (prefix, ns) => {
                if (!prefix || !ns) return;
                const namespace = typeof ns === 'string' ? ns : ns.value;
                if (namespace) {
                    prefixes[prefix] = namespace;
                }
            });
            store.addQuads(quads);
            parsedAtLeastOneFile = true;
        } catch (e) {
            console.warn(`VocabHtmlParser: Failed to parse TTL file ${ttlFile.path}:`, e);
        }
    }

    if (!parsedAtLeastOneFile) return null;
    return { store, prefixes };
}

function resolveTermIri(term: string, prefixes: Record<string, string>, store: N3.Store): string | undefined {
    const namedNode = N3.DataFactory.namedNode;
    const hasTermInStore = (iri: string): boolean => (
        store.countQuads(namedNode(iri), null, null, null) > 0 ||
        store.countQuads(null, null, namedNode(iri), null) > 0
    );

    // Try prefix expansion first (e.g. "ujg:Node")
    if (term.includes(':')) {
        const colonIdx = term.indexOf(':');
        const prefix = term.slice(0, colonIdx);
        const local = term.slice(colonIdx + 1);
        const ns = prefixes[prefix];
        if (ns) {
            const expanded = ns + local;
            if (hasTermInStore(expanded)) return expanded;
        }
    }

    // Fallback: match local name in store subjects
    const localName = term.includes(':') ? term.split(':').pop()! : term;
    const subject = store.getSubjects(null, null, null).find((s) =>
        s.termType === 'NamedNode' &&
        (s.value.endsWith('#' + localName) || s.value.endsWith('/' + localName))
    );
    if (subject?.value) return subject.value;

    const object = store.getObjects(null, null, null).find((o) =>
        o.termType === 'NamedNode' &&
        (o.value.endsWith('#' + localName) || o.value.endsWith('/' + localName))
    );
    return object?.termType === 'NamedNode' ? object.value : undefined;
}

// ============================================================================
// JSON-LD Parsing
// ============================================================================

function parseJsonLd(
    content: string,
    request: SpecTargetRequest,
    sourcePos: SourcePos
): BlockHandlerResult {
    try {
        const parsed: unknown = JSON.parse(content);
        const graph = Array.isArray((parsed as Record<string, unknown>)['@graph'])
            ? ((parsed as Record<string, unknown>)['@graph'] as unknown[])
            : Array.isArray(parsed)
                ? (parsed as unknown[])
                : [parsed];

        const localName = request.value.includes(':') ? request.value.split(':').pop()! : request.value;

        const termNode = graph.find((node): node is Record<string, unknown> =>
            typeof (node as Record<string, unknown>)['@id'] === 'string' &&
            (
                (node as Record<string, unknown>)['@id'] === request.value ||
                ((node as Record<string, unknown>)['@id'] as string).endsWith('#' + localName) ||
                ((node as Record<string, unknown>)['@id'] as string).endsWith('/' + localName)
            )
        );

        if (termNode) {
            if (request.kind === 'class') {
                return generateClassProseFromJson(termNode, sourcePos);
            }
            return generatePropertyProseFromJson(termNode, sourcePos);
        }
    } catch (e) {
        console.warn(`VocabHtmlParser: Failed to parse JSON-LD:`, e);
    }
    return null;
}

type ContextTermRule = {
    term: string;
    iri?: string;
    typeCoercion?: string;
    container?: string;
    isNest?: boolean;
    isAlias?: boolean;
    targetKeyword?: string;
    isPrefix?: boolean;
};

type ContextModel = {
    vocab?: string;
    prefixes: Record<string, string>;
    name: string;
    terms: ContextTermRule[];
};

function parseContextJsonLd(
    content: string,
    contextName: string,
    sourcePos: SourcePos,
    sideFiles?: Record<string, string>,
    contextPath?: string,
    showExpandedIri: boolean = false
): BlockHandlerResult {
    try {
        const parsed: unknown = JSON.parse(content);
        const doc = parsed as Record<string, unknown>;
        const ctxNode = doc['@context'] || doc;

        const flattenedContext = normalizeContext(ctxNode, sideFiles || {}, {
            maxImportDepth: DEFAULT_CONTEXT_IMPORT_MAX_DEPTH,
            contextPath,
        });

        const model = extractContextModel(flattenedContext, contextName);
        return generateContextProse(model, sourcePos, showExpandedIri);
    } catch (e) {
        console.warn(`VocabHtmlParser: Failed to parse JSON-LD Context:`, e);
    }
    return null;
}

function normalizeContext(
    ctxNode: unknown,
    sideFiles: Record<string, string>,
    options?: NormalizeContextOptions
): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    const orderedSideFiles = toOrderedSideFileEntries(sideFiles);
    const visitedImports = new Set<string>();
    const maxImportDepth = options?.maxImportDepth ?? DEFAULT_CONTEXT_IMPORT_MAX_DEPTH;

    const processImport = (importRef: string, depth: number, importerPath?: string) => {
        if (depth > maxImportDepth) {
            console.warn(`VocabHtmlParser: Max JSON-LD context import depth (${maxImportDepth}) exceeded for ${importRef}`);
            return;
        }

        const imported = findImportedContext(importRef, orderedSideFiles, importerPath ?? options?.contextPath);
        if (!imported) return;

        if (visitedImports.has(imported.id)) {
            return;
        }

        visitedImports.add(imported.id);
        processNode(imported.contextNode, depth + 1, imported.path);
    };

    const processNode = (node: unknown, depth: number, currentContextPath?: string) => {
        if (depth > maxImportDepth) {
            console.warn(`VocabHtmlParser: Max JSON-LD context nesting depth (${maxImportDepth}) exceeded`);
            return;
        }

        if (typeof node === 'string') {
            // It could be an @import string instead of an object
            processImport(node, depth, currentContextPath);
        } else if (Array.isArray(node)) {
            for (const item of node) {
                processNode(item, depth, currentContextPath);
            }
        } else if (typeof node === 'object' && node !== null) {
            const obj = node as Record<string, unknown>;
            
            // Handle @import
            if (typeof obj['@import'] === 'string') {
                processImport(obj['@import'], depth, currentContextPath);
            }

            // Merge keys (overriding earlier ones, matching JSON-LD behavior)
            for (const [k, v] of Object.entries(obj)) {
                if (k !== '@import') {
                    flat[k] = v;
                }
            }
        }
    };

    processNode(ctxNode, 0, options?.contextPath);
    return flat;
}

function findImportedContext(
    reference: string,
    sideFiles: SideFileEntry[],
    importerPath?: string
): ImportedContextMatch | null {
    const sanitizedReference = sanitizeImportReference(reference);
    if (!sanitizedReference) return null;

    const candidates: SideFileEntry[] = [];
    const seenCandidates = new Set<string>();
    const addCandidate = (candidate: SideFileEntry | undefined) => {
        if (!candidate) return;
        if (seenCandidates.has(candidate.normalizedPath)) return;
        seenCandidates.add(candidate.normalizedPath);
        candidates.push(candidate);
    };

    const normalizedReference = normalizePathSegments(sanitizedReference);
    if (isAbsolutePath(normalizedReference)) {
        addCandidate(sideFiles.find((entry) => entry.normalizedPath === normalizedReference));
    } else if (importerPath) {
        const resolved = resolvePathFromImporter(importerPath, normalizedReference);
        addCandidate(sideFiles.find((entry) => entry.normalizedPath === resolved));
    }

    if (normalizedReference.includes('/')) {
        const suffixMatches = sideFiles.filter((entry) => pathEndsWith(entry.normalizedPath, normalizedReference));
        for (const candidate of rankCandidatesByImporter(suffixMatches, importerPath)) {
            addCandidate(candidate);
        }
    }

    const targetFilename = getImportTargetFileName(reference);
    const filenameMatches = sideFiles.filter((entry) => entry.fileName === targetFilename);
    for (const candidate of rankCandidatesByImporter(filenameMatches, importerPath)) {
        addCandidate(candidate);
    }

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate.content) as Record<string, unknown>;
            return {
                id: candidate.normalizedPath,
                path: candidate.normalizedPath,
                contextNode: parsed['@context'] || parsed,
            };
        } catch (e) {
            console.warn(`VocabHtmlParser: Failed to parse imported JSON-LD context from ${candidate.path}:`, e);
        }
    }

    return null;
}

function getImportTargetFileName(reference: string): string {
    const sanitizedReference = sanitizeImportReference(reference);
    if (!sanitizedReference) return '';
    return getFileName(sanitizedReference);
}

function sanitizeImportReference(reference: string): string {
    return reference.split('#')[0].split('?')[0].trim();
}

function rankCandidatesByImporter(candidates: SideFileEntry[], importerPath?: string): SideFileEntry[] {
    if (candidates.length <= 1 || !importerPath) return candidates;
    const importerDir = getDirectoryPath(importerPath);
    return [...candidates].sort((a, b) => {
        const distanceDelta = getPathDistance(importerDir, getDirectoryPath(a.normalizedPath))
            - getPathDistance(importerDir, getDirectoryPath(b.normalizedPath));
        if (distanceDelta !== 0) return distanceDelta;
        return a.normalizedPath.localeCompare(b.normalizedPath);
    });
}

function getPathDistance(fromPath: string, toPath: string): number {
    const fromSegments = getPathSegments(fromPath);
    const toSegments = getPathSegments(toPath);
    const commonDepth = getCommonPrefixDepth(fromSegments, toSegments);
    const fromRemaining = fromSegments.length - commonDepth;
    const toRemaining = toSegments.length - commonDepth;
    return fromRemaining + toRemaining;
}

function getCommonPrefixDepth(a: string[], b: string[]): number {
    const limit = Math.min(a.length, b.length);
    let index = 0;
    while (index < limit && a[index] === b[index]) {
        index++;
    }
    return index;
}

function getPathSegments(path: string): string[] {
    const normalized = normalizePathSegments(path);
    const withoutDrive = normalized.replace(/^[A-Za-z]:\//, '');
    const withoutRoot = withoutDrive.startsWith('/') ? withoutDrive.slice(1) : withoutDrive;
    if (!withoutRoot) return [];
    return withoutRoot.split('/').filter((segment) => segment.length > 0);
}

function getDirectoryPath(path: string): string {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) return '';
    if (lastSlash === 0) return '/';
    return normalized.slice(0, lastSlash);
}

function isAbsolutePath(path: string): boolean {
    return path.startsWith('/') || /^[A-Za-z]:\//.test(path);
}

function resolvePathFromImporter(importerPath: string, referencePath: string): string {
    if (isAbsolutePath(referencePath)) {
        return normalizePathSegments(referencePath);
    }

    const importerDir = getDirectoryPath(importerPath);
    const joined = importerDir ? `${importerDir}/${referencePath}` : referencePath;
    return normalizePathSegments(joined);
}

function pathEndsWith(candidatePath: string, referencePath: string): boolean {
    const normalizedCandidate = normalizePathSegments(candidatePath);
    const normalizedReference = normalizePathSegments(referencePath);
    if (normalizedCandidate === normalizedReference) return true;
    return normalizedCandidate.endsWith(`/${normalizedReference}`);
}

function normalizePathSegments(path: string): string {
    const normalized = normalizePath(path);
    if (!normalized) return normalized;

    const hasDrivePrefix = /^[A-Za-z]:\//.test(normalized);
    const drivePrefix = hasDrivePrefix ? normalized.slice(0, 2) : '';
    const absoluteWithoutDrive = hasDrivePrefix ? normalized.slice(2).startsWith('/') : normalized.startsWith('/');
    const pathWithoutPrefix = hasDrivePrefix ? normalized.slice(2) : normalized;
    const rawSegments = pathWithoutPrefix.split('/');
    const resolved: string[] = [];

    for (const segment of rawSegments) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
                resolved.pop();
            } else if (!absoluteWithoutDrive) {
                resolved.push('..');
            }
            continue;
        }
        resolved.push(segment);
    }

    const joined = resolved.join('/');
    if (drivePrefix) {
        return joined ? `${drivePrefix}/${joined}` : `${drivePrefix}/`;
    }
    if (absoluteWithoutDrive) {
        return joined ? `/${joined}` : '/';
    }
    return joined;
}

function extractContextModel(ctxNode: Record<string, unknown>, contextName: string): ContextModel {
    const model: ContextModel = {
        name: contextName,
        prefixes: {},
        terms: []
    };

    if (typeof ctxNode['@vocab'] === 'string') {
        model.vocab = ctxNode['@vocab'];
    }

    for (const [key, value] of Object.entries(ctxNode)) {
        if (key.startsWith('@')) continue; // Skip keywords like @vocab, @version

        if (typeof value === 'string') {
            if (value === '@nest') { // e.g. "meta": "@nest"
                model.terms.push({ term: key, isNest: true });
            } else if (value.startsWith('@')) {
                model.terms.push({ term: key, isAlias: true, targetKeyword: value });
            } else {
                const isPrefix = isContextPrefixDeclaration(key, value);
                if (isPrefix) {
                    model.prefixes[key] = value;
                }
                model.terms.push({ term: key, iri: value, isPrefix });
            }
        } else if (typeof value === 'object' && value !== null) {
            const termDef = value as Record<string, unknown>;
            if (typeof termDef['@id'] === 'string') {
                const isPrefix = termDef['@prefix'] === true && isAbsoluteIri(termDef['@id']);
                if (isPrefix) {
                    model.prefixes[key] = termDef['@id'];
                }
                const rule: ContextTermRule = { term: key, iri: termDef['@id'], isPrefix };
                if (typeof termDef['@type'] === 'string') {
                    rule.typeCoercion = termDef['@type'];
                }
                if (typeof termDef['@container'] === 'string') {
                    rule.container = termDef['@container'];
                }
                model.terms.push(rule);
            }
        }
    }

    return model;
}

// ============================================================================
// Prose Generation
// ============================================================================

const RDFS = {
    label: 'http://www.w3.org/2000/01/rdf-schema#label',
    comment: 'http://www.w3.org/2000/01/rdf-schema#comment',
    domain: 'http://www.w3.org/2000/01/rdf-schema#domain',
    range: 'http://www.w3.org/2000/01/rdf-schema#range',
};

const SHACL = {
    targetClass: 'http://www.w3.org/ns/shacl#targetClass',
    property: 'http://www.w3.org/ns/shacl#property',
    path: 'http://www.w3.org/ns/shacl#path',
    minCount: 'http://www.w3.org/ns/shacl#minCount',
    maxCount: 'http://www.w3.org/ns/shacl#maxCount',
    datatype: 'http://www.w3.org/ns/shacl#datatype',
    class: 'http://www.w3.org/ns/shacl#class',
    node: 'http://www.w3.org/ns/shacl#node',
    nodeKind: 'http://www.w3.org/ns/shacl#nodeKind',
};

function generateClassProse(iri: string, store: N3.Store, ctx: ParseContext, sourcePos: SourcePos): Block[] {
    void ctx; // ctx reserved for future use (e.g. xref linking)
    const blocks: Block[] = [];

    const comment = getFirstLiteralObjectValue(store, iri, RDFS.comment);
    if (comment) {
        blocks.push({
            type: 'paragraph',
            children: [{ type: 'text', value: comment }],
            sourcePos
        });
    }

    // blocks.push({
    //     type: 'paragraph',
    //     children: [
    //         { type: 'text', value: 'It ' },
    //         { type: 'requirement', keyword: 'MUST' },
    //         { type: 'text', value: ' satisfy the following schema:' }
    //     ],
    //     sourcePos
    // });

    const propertyModels = buildClassPropertyModels(iri, store);
    if (propertyModels.length > 0) {
        const rows: TableRow[] = [
            {
                type: 'tableRow',
                children: [
                    createHeaderCell('Field'),
                    createHeaderCell('Requirement'),
                    createHeaderCell('Description'),
                    createHeaderCell('Value Type')
                ]
            }
        ];

        for (const property of propertyModels) {
            rows.push({
                type: 'tableRow',
                children: [
                    createCell(property.name, true),
                    createCell(formatRequirement(property.cardinality)),
                    createCell(property.comment || property.label || ''),
                    createCell(property.valueType, true)
                ]
            });
        }

        blocks.push({
            type: 'table',
            children: rows,
            id: getLocalName(iri),
            sourcePos
        });
    }

    return blocks;
}

function generatePropertyProse(propertyIri: string, store: N3.Store, sourcePos: SourcePos): Block[] {
    const blocks: Block[] = [];
    const propertyName = getLocalName(propertyIri);
    const comment = getFirstLiteralObjectValue(store, propertyIri, RDFS.comment);
    const label = getFirstLiteralObjectValue(store, propertyIri, RDFS.label);
    const domains = getNamedNodeObjectValues(store, propertyIri, RDFS.domain).map((iri) => getLocalName(iri));
    const ranges = getNamedNodeObjectValues(store, propertyIri, RDFS.range).map((iri) => getLocalName(iri));
    const targetClasses = getShaclTargetClassesForProperty(propertyIri, store).map((iri) => getLocalName(iri));

    if (comment) {
        blocks.push({
            type: 'paragraph',
            children: [{ type: 'text', value: comment }],
            sourcePos
        });
    }

    blocks.push({
        type: 'paragraph',
        children: [
            { type: 'text', value: 'The ' },
            { type: 'inlineCode', value: propertyName },
            { type: 'text', value: ' property ' },
            { type: 'requirement', keyword: 'MUST' },
            { type: 'text', value: ' satisfy the following definition metadata:' }
        ],
        sourcePos
    });

    const rows: TableRow[] = [
        {
            type: 'tableRow',
            children: [
                createHeaderCell('Constraint'),
                createHeaderCell('Value')
            ]
        },
        {
            type: 'tableRow',
            children: [
                createCell('IRI', true),
                createCell(propertyIri, true)
            ]
        }
    ];

    if (label) {
        rows.push({
            type: 'tableRow',
            children: [
                createCell('Label', true),
                createCell(label)
            ]
        });
    }
    if (domains.length > 0) {
        rows.push({
            type: 'tableRow',
            children: [
                createCell('Domain', true),
                createCell(domains.join(', '), true)
            ]
        });
    }
    if (ranges.length > 0) {
        rows.push({
            type: 'tableRow',
            children: [
                createCell('Range', true),
                createCell(ranges.join(', '), true)
            ]
        });
    }
    if (targetClasses.length > 0) {
        rows.push({
            type: 'tableRow',
            children: [
                createCell('SHACL Target Class', true),
                createCell(targetClasses.join(', '), true)
            ]
        });
    }

    blocks.push({
        type: 'table',
        children: rows,
        id: propertyName,
        sourcePos
    });

    return blocks;
}

function buildClassPropertyModels(classIri: string, store: N3.Store): ClassPropertyModel[] {
    const propertyNodes = discoverClassProperties(classIri, store);
    return propertyNodes.map((propertyIri) => {
        const shacl = collectShaclConstraintsForClassProperty(classIri, propertyIri, store);
        const rdfsRanges = getNamedNodeObjectValues(store, propertyIri, RDFS.range).map((iri) => getLocalName(iri));
        return {
            iri: propertyIri,
            name: getLocalName(propertyIri),
            label: getFirstLiteralObjectValue(store, propertyIri, RDFS.label),
            comment: getFirstLiteralObjectValue(store, propertyIri, RDFS.comment),
            valueType: resolveValueType(shacl.valueTypes, rdfsRanges),
            cardinality: {
                cardinality: shacl.cardinality,
                contributingShapeCount: shacl.contributingShapeCount,
                hasConflict: hasCardinalityConflict(shacl.cardinality),
            },
        };
    });
}

function discoverClassProperties(classIri: string, store: N3.Store): string[] {
    const propertySet = new Set<string>();
    const namedNode = N3.DataFactory.namedNode;

    const domainQuads = store.getQuads(
        null,
        namedNode(RDFS.domain),
        namedNode(classIri),
        null
    );
    for (const quad of domainQuads) {
        if (quad.subject.termType === 'NamedNode') {
            propertySet.add(quad.subject.value);
        }
    }

    const nodeShapes = store.getSubjects(
        namedNode(SHACL.targetClass),
        namedNode(classIri),
        null
    );
    for (const nodeShape of nodeShapes) {
        const propertyShapes = store.getObjects(
            nodeShape,
            namedNode(SHACL.property),
            null
        );
        for (const propertyShape of propertyShapes) {
            const pathNode = store.getObjects(propertyShape, namedNode(SHACL.path), null)[0];
            if (pathNode?.termType === 'NamedNode') {
                propertySet.add(pathNode.value);
            }
        }
    }

    return Array.from(propertySet);
}

function collectShaclConstraintsForClassProperty(
    classIri: string,
    propertyIri: string,
    store: N3.Store
): ShaclClassPropertyConstraints {
    const namedNode = N3.DataFactory.namedNode;
    const nodeShapes = store.getSubjects(
        namedNode(SHACL.targetClass),
        namedNode(classIri),
        null
    );

    const contributingShapes = new Set<string>();
    let mergedCardinality: PropertyCardinality | null = null;
    const valueTypes = new Set<string>();
    for (const nodeShape of nodeShapes) {
        const propertyShapes = store.getObjects(
            nodeShape,
            namedNode(SHACL.property),
            null
        );
        for (const propertyShape of propertyShapes) {
            const pathNode = store.getObjects(propertyShape, namedNode(SHACL.path), null)[0];
            if (!pathNode || pathNode.termType !== 'NamedNode' || pathNode.value !== propertyIri) {
                continue;
            }

            contributingShapes.add(termIdentity(nodeShape));

            const min = parseShaclCountLiteral(store.getObjects(propertyShape, namedNode(SHACL.minCount), null)[0]);
            const max = parseShaclCountLiteral(store.getObjects(propertyShape, namedNode(SHACL.maxCount), null)[0]);
            mergedCardinality = mergeCardinality(mergedCardinality, {
                min: min === null ? undefined : min,
                max: max === null ? undefined : max,
            });

            appendValueTypeTerms(valueTypes, store.getObjects(propertyShape, namedNode(SHACL.datatype), null));
            appendValueTypeTerms(valueTypes, store.getObjects(propertyShape, namedNode(SHACL.class), null));
            appendValueTypeTerms(valueTypes, store.getObjects(propertyShape, namedNode(SHACL.node), null));
            appendValueTypeTerms(valueTypes, store.getObjects(propertyShape, namedNode(SHACL.nodeKind), null));
        }
    }

    return {
        cardinality: mergedCardinality,
        contributingShapeCount: contributingShapes.size,
        valueTypes: Array.from(valueTypes),
    };
}

function appendValueTypeTerms(target: Set<string>, terms: N3.Term[]): void {
    for (const term of terms) {
        target.add(termToDisplayText(term));
    }
}

function termToDisplayText(term: N3.Term): string {
    if (term.termType === 'NamedNode') {
        return getLocalName(term.value);
    }
    if (term.termType === 'Literal') {
        return term.value;
    }
    return term.value;
}

function termIdentity(term: N3.Term): string {
    if (term.termType === 'BlankNode') {
        return `_:${term.value}`;
    }
    return term.value;
}

function resolveValueType(shaclTypes: string[], rdfsRanges: string[]): string {
    if (shaclTypes.length > 0) {
        return shaclTypes.join(' | ');
    }
    if (rdfsRanges.length > 0) {
        return rdfsRanges.join(' | ');
    }
    return 'unspecified';
}

function getShaclTargetClassesForProperty(propertyIri: string, store: N3.Store): string[] {
    const namedNode = N3.DataFactory.namedNode;
    const results = new Set<string>();
    const nodeShapes = store.getSubjects(
        null,
        namedNode(SHACL.property),
        null
    );

    for (const nodeShape of nodeShapes) {
        const propertyShapes = store.getObjects(
            nodeShape,
            namedNode(SHACL.property),
            null
        );
        for (const propertyShape of propertyShapes) {
            const pathNode = store.getObjects(propertyShape, namedNode(SHACL.path), null)[0];
            if (!pathNode || pathNode.termType !== 'NamedNode' || pathNode.value !== propertyIri) {
                continue;
            }

            const targetClasses = store.getObjects(
                nodeShape,
                namedNode(SHACL.targetClass),
                null
            );
            for (const targetClass of targetClasses) {
                if (targetClass.termType === 'NamedNode') {
                    results.add(targetClass.value);
                }
            }
        }
    }

    return Array.from(results);
}

function getNamedNodeObjectValues(store: N3.Store, subjectIri: string, predicateIri: string): string[] {
    const objects = store.getObjects(
        N3.DataFactory.namedNode(subjectIri),
        N3.DataFactory.namedNode(predicateIri),
        null
    );
    const values = objects
        .filter((term): term is N3.NamedNode => term.termType === 'NamedNode')
        .map((term) => term.value);

    return Array.from(new Set(values));
}

function getFirstLiteralObjectValue(store: N3.Store, subjectIri: string, predicateIri: string): string | undefined {
    const object = store.getObjects(
        N3.DataFactory.namedNode(subjectIri),
        N3.DataFactory.namedNode(predicateIri),
        null
    )[0];
    return object?.termType === 'Literal' ? object.value : undefined;
}

function getLocalName(iri: string): string {
    return iri.split(/[#/]/).pop() || iri;
}

function mergeCardinality(
    current: PropertyCardinality | null,
    incoming: PropertyCardinality
): PropertyCardinality {
    if (!current) return incoming;

    const merged: PropertyCardinality = {};

    const currentMin = current.min ?? 0;
    const incomingMin = incoming.min ?? 0;
    const min = Math.max(currentMin, incomingMin);
    if (min > 0) {
        merged.min = min;
    }

    if (current.max === undefined && incoming.max !== undefined) {
        merged.max = incoming.max;
    } else if (current.max !== undefined && incoming.max === undefined) {
        merged.max = current.max;
    } else if (current.max !== undefined && incoming.max !== undefined) {
        merged.max = Math.min(current.max, incoming.max);
    }

    return merged;
}

function formatRequirement(summary: PropertyCardinalitySummary): string {
    const { cardinality, hasConflict, contributingShapeCount } = summary;
    if (hasConflict && cardinality) {
        const minValue = cardinality.min ?? 0;
        const maxValue = cardinality.max === undefined ? '*' : String(cardinality.max);
        return `conflicting constraints (${minValue}..${maxValue})`;
    }

    if (!cardinality || (cardinality.min === undefined && cardinality.max === undefined)) {
        return 'optional (unspecified)';
    }

    const min = cardinality.min ?? 0;
    const max = cardinality.max;
    let base = 'optional (0..*)';
    if (min >= 1 && max === 1) base = 'required (1..1)';
    else if (min >= 1 && max !== undefined) base = `required (${min}..${max})`;
    else if (min >= 1) base = `required (${min}..*)`;
    else if (max === 1) base = 'optional (0..1)';
    else if (max !== undefined) base = `optional (0..${max})`;

    if (contributingShapeCount > 1 && base !== 'optional (unspecified)') {
        return `${base} [effective across ${contributingShapeCount} shapes]`;
    }

    return base;
}

function parseShaclCountLiteral(term: N3.Term | null | undefined): number | null {
    if (!term) return null;
    if (term.termType !== 'Literal') return null;
    const parsed = Number(term.value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}

function hasCardinalityConflict(cardinality: PropertyCardinality | null): boolean {
    if (!cardinality) return false;
    if (cardinality.min === undefined || cardinality.max === undefined) return false;
    return cardinality.min > cardinality.max;
}

function generateClassProseFromJson(node: Record<string, unknown>, sourcePos: SourcePos): Block[] {
    const blocks: Block[] = [];
    const comment = node['rdfs:comment'] || node['comment'] || node['description'];

    if (comment) {
        const commentText = typeof comment === 'string'
            ? comment
            : (comment as Record<string, string>)['@value'] || '';
        blocks.push({
            type: 'paragraph',
            children: [{ type: 'text', value: commentText }],
            sourcePos
        });
    }

    blocks.push({
        type: 'paragraph',
        children: [
            {
                type: 'text',
                value: 'Informative fallback: JSON-LD term metadata was found, but normative schema extraction requires Turtle/SHACL side files.'
            }
        ],
        sourcePos
    });

    return blocks;
}

function generatePropertyProseFromJson(node: Record<string, unknown>, sourcePos: SourcePos): Block[] {
    const blocks: Block[] = [];
    const comment = node['rdfs:comment'] || node['comment'] || node['description'];

    if (comment) {
        const commentText = typeof comment === 'string'
            ? comment
            : (comment as Record<string, string>)['@value'] || '';
        blocks.push({
            type: 'paragraph',
            children: [{ type: 'text', value: commentText }],
            sourcePos
        });
    }

    blocks.push({
        type: 'paragraph',
        children: [
            {
                type: 'text',
                value: 'Informative fallback: JSON-LD property metadata was found, but normative schema extraction requires Turtle/SHACL side files.'
            }
        ],
        sourcePos
    });

    return blocks;
}

function generateContextProse(model: ContextModel, sourcePos: SourcePos, showExpandedIri: boolean = false): Block[] {
    const blocks: Block[] = [];

    // @vocab
    if (model.vocab) {
        blocks.push({
            type: 'paragraph',
            children: [
                { type: 'text', value: 'The ' },
                { type: 'inlineCode', value: model.name },
                { type: 'text', value: ' JSON-LD context ' },
                { type: 'requirement', keyword: 'MUST' },
                { type: 'text', value: ' set ' },
                { type: 'inlineCode', value: '@vocab' },
                { type: 'text', value: ' to the ' },
                { type: 'inlineCode', value: model.vocab },
                { type: 'text', value: ' namespace.' }
            ],
            sourcePos
        });
    }

    // Term mappings
    for (const rule of model.terms) {
        if (rule.isNest) {
            blocks.push({
                type: 'paragraph',
                children: [
                    { type: 'text', value: 'The ' },
                    { type: 'inlineCode', value: rule.term },
                    { type: 'text', value: ' term is an ' },
                    { type: 'inlineCode', value: '@nest' },
                    { type: 'text', value: ' alias; nested members ' },
                    { type: 'requirement', keyword: 'MUST' },
                    { type: 'text', value: ' be interpreted as direct properties.' }
                ],
                sourcePos
            });
        } else if (rule.isAlias) {
            blocks.push({
                type: 'paragraph',
                children: [
                    { type: 'text', value: 'The ' },
                    { type: 'inlineCode', value: rule.term },
                    { type: 'text', value: ' term ' },
                    { type: 'requirement', keyword: 'MUST' },
                    { type: 'text', value: ' be an alias for the JSON-LD ' },
                    { type: 'inlineCode', value: rule.targetKeyword! },
                    { type: 'text', value: ' keyword.' }
                ],
                    sourcePos
                });
        } else if (rule.iri) {
            const expandedIri = showExpandedIri ? expandContextIri(rule.iri, model) : rule.iri;
            if (rule.isPrefix) {
                blocks.push({
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'The ' },
                        { type: 'inlineCode', value: rule.term },
                        { type: 'text', value: ' prefix ' },
                        { type: 'requirement', keyword: 'MUST' },
                        { type: 'text', value: ' expand to ' },
                        { type: 'inlineCode', value: expandedIri },
                        { type: 'text', value: '.' }
                    ],
                    sourcePos
                });
                continue;
            }

            if (rule.typeCoercion === '@id') {
                blocks.push({
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'The ' },
                        { type: 'inlineCode', value: rule.term },
                        { type: 'text', value: ' term maps to ' },
                        { type: 'inlineCode', value: expandedIri },
                        { type: 'text', value: ' and values ' },
                        { type: 'requirement', keyword: 'MUST' },
                        { type: 'text', value: ' be interpreted as IRIs.' }
                    ],
                    sourcePos
                });
            } else if (rule.typeCoercion === '@json') {
                blocks.push({
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'The ' },
                        { type: 'inlineCode', value: rule.term },
                        { type: 'text', value: ' term ' },
                        { type: 'requirement', keyword: 'MAY' },
                        { type: 'text', value: ' be represented as an ' },
                        { type: 'inlineCode', value: '@json' },
                        { type: 'text', value: ' literal.' }
                    ],
                    sourcePos
                });
            } else if (rule.typeCoercion) {
                blocks.push({
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'The ' },
                        { type: 'inlineCode', value: rule.term },
                        { type: 'text', value: ' term maps to ' },
                        { type: 'inlineCode', value: expandedIri },
                        { type: 'text', value: ' and values ' },
                        { type: 'requirement', keyword: 'MUST' },
                        { type: 'text', value: ' be of type ' },
                        { type: 'inlineCode', value: expandContextType(rule.typeCoercion, model) },
                        { type: 'text', value: '.' }
                    ],
                    sourcePos
                });
            } else {
                blocks.push({
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'The ' },
                        { type: 'inlineCode', value: rule.term },
                        { type: 'text', value: ' term ' },
                        { type: 'requirement', keyword: 'MUST' },
                        { type: 'text', value: ' map to ' },
                        { type: 'inlineCode', value: expandedIri },
                        { type: 'text', value: '.' }
                    ],
                    sourcePos
                });
            }

            if (rule.container === '@set') {
                blocks.push({
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'The ' },
                        { type: 'inlineCode', value: rule.term },
                        { type: 'text', value: ' term uses ' },
                        { type: 'inlineCode', value: '@set' },
                        { type: 'text', value: '; processors ' },
                        { type: 'requirement', keyword: 'MUST' },
                        { type: 'text', value: ' accept array form consistently for single or multiple values.' }
                    ],
                    sourcePos
                });
            }
        }
    }

    return blocks;
}

function isContextPrefixDeclaration(term: string, iri: string): boolean {
    if (term.includes(':')) return false;
    if (!isAbsoluteIri(iri)) return false;
    return iri.endsWith('/') || iri.endsWith('#');
}

function isAbsoluteIri(value: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function expandContextIri(value: string, model: ContextModel): string {
    if (!value || value.startsWith('@')) return value;
    if (isAbsoluteIri(value)) {
        const colonIndex = value.indexOf(':');
        const prefix = colonIndex === -1 ? value : value.slice(0, colonIndex);
        if (colonIndex !== -1 && model.prefixes[prefix]) {
            return model.prefixes[prefix] + value.slice(colonIndex + 1);
        }
        return value;
    }

    if (value.includes(':')) {
        const colonIndex = value.indexOf(':');
        const prefix = value.slice(0, colonIndex);
        const local = value.slice(colonIndex + 1);
        const ns = model.prefixes[prefix];
        if (ns) return ns + local;
        return value;
    }

    if (model.vocab) {
        return `${model.vocab}${value}`;
    }
    return value;
}

function expandContextType(value: string, model: ContextModel): string {
    if (value.startsWith('@')) return value;
    return expandContextIri(value, model);
}

// ============================================================================
// Cell helpers
// ============================================================================

function createHeaderCell(text: string): TableCell {
    return {
        type: 'tableCell',
        header: true,
        children: [{ type: 'text', value: text }]
    };
}

function createCell(text: string, code: boolean = false): TableCell {
    return {
        type: 'tableCell',
        children: [
            code
                ? { type: 'inlineCode', value: text }
                : { type: 'text', value: text }
        ]
    };
}
