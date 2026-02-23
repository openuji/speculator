/**
 * Vocab HTML Parser
 *
 * Handles <spec-vocab> custom elements.
 * Scans for sibling metadata files (*.ttl, *.jsonld, *.schema.json)
 * and generates normative prose (Tables, Statements) from them.
 */

import fs from 'node:fs';
import path from 'node:path';
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
        const sourceFile = ctx.unit.file;
        const dir = path.dirname(sourceFile);

        let siblings: string[];
        try {
            siblings = fs.readdirSync(dir) as string[];
        } catch {
            return null;
        }

        const metadataFiles = siblings.filter(f => 
            f.endsWith('.ttl') || f.endsWith('.jsonld') || f.endsWith('.schema.json')
        ).map(f => path.join(dir, f));

        for (const file of metadataFiles) {
            if (file.endsWith('.ttl')) {
                const content = fs.readFileSync(file, 'utf-8');
                try {
                    const store = new N3.Store();
                    const prefixes: Record<string, string> = {};

                    // N3 synchronous parse with prefix callback (3rd arg)
                    const parser = new N3.Parser();
                    const quads = parser.parse(content, null, (prefix, ns) => {
                        if (prefix && ns) prefixes[prefix] = ns.value ?? ns;
                    });
                    store.addQuads(quads);

                    // Resolve IRI from prefixed term like "ujg:Node"
                    let termIri: string | undefined;
                    if (term.includes(':')) {
                        const colonIdx = term.indexOf(':');
                        const prefix = term.slice(0, colonIdx);
                        const local = term.slice(colonIdx + 1);
                        const ns = prefixes[prefix];
                        if (ns) {
                            termIri = ns + local;
                        }
                    }

                    // Fallback: local name search
                    if (!termIri) {
                        const localName = term.includes(':') ? term.split(':').pop()! : term;
                        const subject = store.getSubjects(null, null, null).find(s =>
                            s.termType === 'NamedNode' &&
                            (s.value.endsWith('#' + localName) || s.value.endsWith('/' + localName))
                        );
                        termIri = subject?.value;
                    }

                    if (termIri) {
                        return generateClassProse(termIri, store, ctx, sourcePos);
                    }
                } catch (e) {
                    console.warn(`VocabHtmlParser: Failed to parse TTL file ${file}:`, e);
                }
            } else if (file.endsWith('.jsonld')) {
                try {
                    const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
                    const graph = content['@graph'] || (Array.isArray(content) ? content : [content]);
                    const localName = term.includes(':') ? term.split(':').pop()! : term;

                    const termNode = graph.find((node: Record<string, unknown>) =>
                        typeof node['@id'] === 'string' &&
                        (node['@id'] === term ||
                         (node['@id'] as string).endsWith('#' + localName) ||
                         (node['@id'] as string).endsWith('/' + localName))
                    );

                    if (termNode) {
                        return generateClassProseFromJson(termNode, sourcePos);
                    }
                } catch (e) {
                    console.warn(`VocabHtmlParser: Failed to parse JSON-LD file ${file}:`, e);
                }
            }
        }

        return null;
    }
};

const RDFS = {
    label: 'http://www.w3.org/2000/01/rdf-schema#label',
    comment: 'http://www.w3.org/2000/01/rdf-schema#comment',
    domain: 'http://www.w3.org/2000/01/rdf-schema#domain',
    range: 'http://www.w3.org/2000/01/rdf-schema#range'
};

function generateClassProse(iri: string, store: N3.Store, ctx: ParseContext, sourcePos: SourcePos): Block[] {
    const blocks: Block[] = [];

    // 1. Heading or Label
    const comment = store.getObjects(N3.DataFactory.namedNode(iri), N3.DataFactory.namedNode(RDFS.comment), null)[0]?.value;

    if (comment) {
        blocks.push({
            type: 'paragraph',
            children: [{ type: 'text', value: comment }],
            sourcePos
        });
    }

    // 2. Requirement Sentence
    blocks.push({
        type: 'paragraph',
        children: [
            { type: 'text', value: 'It ' },
            { type: 'requirement', keyword: 'MUST' },
            { type: 'text', value: ' satisfy the following schema:' }
        ],
        sourcePos
    });

    // 3. Property Table
    // Properties are those having rdfs:domain the current IRI
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
            const pLabel = store.getObjects(propNode, N3.DataFactory.namedNode(RDFS.label), null)[0]?.value;

            rows.push({
                type: 'tableRow',
                children: [
                    createCell(propName, true),
                    createCell('required'), // Default to required for now
                    createCell(pComment || pLabel || '')
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

    // TODO: Handle properties from JSON-LD if present (e.g. if graph contains them)
    return blocks;
}

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
