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

export const VocabHtmlParser: HtmlParserModule = {
    name: 'VocabHtmlParser',
    handles: ['spec-vocab'],
    order: 4,

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const sourcePos = ctx.createSourcePos(element);
        const sideFiles = ctx.unit.sideFiles;
        if (!sideFiles || Object.keys(sideFiles).length === 0) return null;

        const term = ctx.getAttr(element, 'class') || ctx.getAttr(element, 'property');
        if (term) {
            for (const [filePath, content] of Object.entries(sideFiles)) {
                if (filePath.endsWith('.ttl')) {
                    const result = parseTtl(content, filePath, term, ctx, sourcePos);
                    if (result) return result;
                } else if (filePath.endsWith('.jsonld')) {
                    const result = parseJsonLd(content, term, sourcePos);
                    if (result) return result;
                }
            }
            return null;
        }

        const contextAttr = ctx.getAttr(element, 'context');
        if (contextAttr !== undefined) {
            const isDefault = contextAttr === 'context' || contextAttr === '';
            const folderName = ctx.unit.file ? ctx.unit.file.split('/').slice(-2, -1)[0] : '';

            if (isDefault) {
                // Try strictly matching the folder name first
                for (const [filePath, content] of Object.entries(sideFiles)) {
                    if (folderName && filePath.endsWith(`/${folderName}.context.jsonld`)) {
                        return parseContextJsonLd(content, folderName, sourcePos, sideFiles);
                    }
                }
                // Fallback: if exactly 1 context file is present
                const contextFiles = Object.entries(sideFiles).filter(([f]) => f.endsWith('.context.jsonld'));
                if (contextFiles.length === 1) {
                    return parseContextJsonLd(contextFiles[0][1], folderName || 'default', sourcePos, sideFiles);
                }
            } else {
                for (const [filePath, content] of Object.entries(sideFiles)) {
                    if (filePath.endsWith('.context.jsonld') && (contextAttr === 'core' || filePath.includes(contextAttr))) {
                        return parseContextJsonLd(content, contextAttr, sourcePos, sideFiles);
                    }
                }
            }

            return null;
        }

        return null;
    }
};

// ============================================================================
// TTL Parsing
// ============================================================================

function parseTtl(
    content: string,
    filePath: string,
    term: string,
    ctx: ParseContext,
    sourcePos: SourcePos
): BlockHandlerResult {
    try {
        const store = new N3.Store();
        const prefixes: Record<string, string> = {};

        const parser = new N3.Parser();
        const quads = parser.parse(content, null, (prefix, ns) => {
            if (prefix && ns) prefixes[prefix] = ns.value ?? ns;
        });
        store.addQuads(quads);

        const termIri = resolveTermIri(term, prefixes, store);
        if (termIri) {
            return generateClassProse(termIri, store, ctx, sourcePos);
        }
    } catch (e) {
        console.warn(`VocabHtmlParser: Failed to parse TTL file ${filePath}:`, e);
    }
    return null;
}

function resolveTermIri(term: string, prefixes: Record<string, string>, store: N3.Store): string | undefined {
    // Try prefix expansion first (e.g. "ujg:Node")
    if (term.includes(':')) {
        const colonIdx = term.indexOf(':');
        const prefix = term.slice(0, colonIdx);
        const local = term.slice(colonIdx + 1);
        const ns = prefixes[prefix];
        if (ns) return ns + local;
    }

    // Fallback: match local name in store subjects
    const localName = term.includes(':') ? term.split(':').pop()! : term;
    const subject = store.getSubjects(null, null, null).find(s =>
        s.termType === 'NamedNode' &&
        (s.value.endsWith('#' + localName) || s.value.endsWith('/' + localName))
    );
    return subject?.value;
}

// ============================================================================
// JSON-LD Parsing
// ============================================================================

function parseJsonLd(
    content: string,
    term: string,
    sourcePos: SourcePos
): BlockHandlerResult {
    try {
        const parsed: unknown = JSON.parse(content);
        const graph = Array.isArray((parsed as Record<string, unknown>)['@graph'])
            ? ((parsed as Record<string, unknown>)['@graph'] as unknown[])
            : Array.isArray(parsed)
                ? (parsed as unknown[])
                : [parsed];

        const localName = term.includes(':') ? term.split(':').pop()! : term;

        const termNode = graph.find((node): node is Record<string, unknown> =>
            typeof (node as Record<string, unknown>)['@id'] === 'string' &&
            (
                (node as Record<string, unknown>)['@id'] === term ||
                ((node as Record<string, unknown>)['@id'] as string).endsWith('#' + localName) ||
                ((node as Record<string, unknown>)['@id'] as string).endsWith('/' + localName)
            )
        );

        if (termNode) {
            return generateClassProseFromJson(termNode, sourcePos);
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
};

type ContextModel = {
    vocab?: string;
    name: string;
    terms: ContextTermRule[];
};

function parseContextJsonLd(
    content: string,
    contextName: string,
    sourcePos: SourcePos,
    sideFiles?: Record<string, string>
): BlockHandlerResult {
    try {
        const parsed: unknown = JSON.parse(content);
        const doc = parsed as Record<string, unknown>;
        const ctxNode = doc['@context'] || doc;

        const flattenedContext = normalizeContext(ctxNode, sideFiles || {});

        const model = extractContextModel(flattenedContext, contextName);
        return generateContextProse(model, sourcePos);
    } catch (e) {
        console.warn(`VocabHtmlParser: Failed to parse JSON-LD Context:`, e);
    }
    return null;
}

function normalizeContext(ctxNode: unknown, sideFiles: Record<string, string>): Record<string, unknown> {
    const flat: Record<string, unknown> = {};

    const processNode = (node: unknown) => {
        if (typeof node === 'string') {
            // It could be an @import string instead of an object
            const importedContent = findImportedContext(node, sideFiles);
            if (importedContent) {
                processNode(importedContent);
            }
        } else if (Array.isArray(node)) {
            for (const item of node) {
                processNode(item);
            }
        } else if (typeof node === 'object' && node !== null) {
            const obj = node as Record<string, unknown>;
            
            // Handle @import
            if (typeof obj['@import'] === 'string') {
                const importUrl = obj['@import'];
                const importedContent = findImportedContext(importUrl, sideFiles);
                if (importedContent) {
                    processNode(importedContent);
                }
            }

            // Merge keys (overriding earlier ones, matching JSON-LD behavior)
            for (const [k, v] of Object.entries(obj)) {
                if (k !== '@import') {
                    flat[k] = v;
                }
            }
        }
    };

    processNode(ctxNode);
    return flat;
}

function findImportedContext(url: string, sideFiles: Record<string, string>): unknown {
    // Attempt to match the filename part of the URL (e.g. core.context.jsonld)
    const targetFilename = url.split('/').pop() || url;
    
    for (const [filePath, content] of Object.entries(sideFiles)) {
        if (filePath.endsWith(targetFilename)) {
            try {
                const parsed = JSON.parse(content) as Record<string, unknown>;
                return parsed['@context'] || parsed;
            } catch (e) {
                console.warn(`VocabHtmlParser: Failed to parse imported JSON-LD context from ${filePath}:`, e);
            }
        }
    }
    return null;
}

function extractContextModel(ctxNode: Record<string, unknown>, contextName: string): ContextModel {
    const model: ContextModel = {
        name: contextName,
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
                model.terms.push({ term: key, iri: value });
            }
        } else if (typeof value === 'object' && value !== null) {
            const termDef = value as Record<string, unknown>;
            if (typeof termDef['@id'] === 'string') {
                const rule: ContextTermRule = { term: key, iri: termDef['@id'] };
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
};

function generateClassProse(iri: string, store: N3.Store, ctx: ParseContext, sourcePos: SourcePos): Block[] {
    void ctx; // ctx reserved for future use (e.g. xref linking)
    const blocks: Block[] = [];

    const comment = store.getObjects(N3.DataFactory.namedNode(iri), N3.DataFactory.namedNode(RDFS.comment), null)[0]?.value;
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
            { type: 'text', value: 'It ' },
            { type: 'requirement', keyword: 'MUST' },
            { type: 'text', value: ' satisfy the following schema:' }
        ],
        sourcePos
    });

    const properties = store.getQuads(null, N3.DataFactory.namedNode(RDFS.domain), N3.DataFactory.namedNode(iri), null);
    if (properties.length > 0) {
        const rows: TableRow[] = [
            {
                type: 'tableRow',
                children: [
                    createHeaderCell('Field'),
                    createHeaderCell('Requirement'),
                    createHeaderCell('Description')
                ]
            }
        ];

        for (const quad of properties) {
            const propNode = quad.subject;
            const propIri = propNode.value;
            const propName = propIri.split(/[#/]/).pop() || propIri;
            const pComment = store.getObjects(propNode, N3.DataFactory.namedNode(RDFS.comment), null)[0]?.value || '';
            const pLabel = store.getObjects(propNode, N3.DataFactory.namedNode(RDFS.label), null)[0]?.value || '';

            rows.push({
                type: 'tableRow',
                children: [
                    createCell(propName, true),
                    createCell('required'),
                    createCell(pComment || pLabel)
                ]
            });
        }

        blocks.push({
            type: 'table',
            children: rows,
            id: iri.split(/[#/]/).pop(),
            sourcePos
        });
    }

    return blocks;
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
            { type: 'text', value: 'It MUST satisfy the following schema:' }
        ],
        sourcePos
    });

    return blocks;
}

function generateContextProse(model: ContextModel, sourcePos: SourcePos): Block[] {
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
            if (rule.typeCoercion === '@id') {
                blocks.push({
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'The ' },
                        { type: 'inlineCode', value: rule.term },
                        { type: 'text', value: ' term maps to ' },
                        { type: 'inlineCode', value: rule.iri },
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
                        { type: 'inlineCode', value: rule.iri },
                        { type: 'text', value: ' and values ' },
                        { type: 'requirement', keyword: 'MUST' },
                        { type: 'text', value: ' be of type ' },
                        { type: 'inlineCode', value: rule.typeCoercion },
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
                        { type: 'inlineCode', value: rule.iri },
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
                        { type: 'text', value: '; values ' },
                        { type: 'requirement', keyword: 'MUST' },
                        { type: 'text', value: ' be handled as set/array form.' }
                    ],
                    sourcePos
                });
            }
        }
    }

    return blocks;
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
