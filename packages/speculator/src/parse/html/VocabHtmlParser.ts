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
        const term = ctx.getAttr(element, 'class') || ctx.getAttr(element, 'property');
        if (!term) return null;

        const sourcePos = ctx.createSourcePos(element);
        const sideFiles = ctx.unit.sideFiles;
        if (!sideFiles || Object.keys(sideFiles).length === 0) return null;

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
