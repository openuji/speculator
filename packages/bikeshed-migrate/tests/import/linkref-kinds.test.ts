import { fromHtml } from 'hast-util-from-html';
import { describe, expect, it } from 'vitest';
import type { Element } from 'hast';
import type { BiblioMap } from '../../src/extract/biblio.js';
import { importNormalizedRegionToIr } from '../../src/import/html-to-ir.js';
import type {
    LinkRefNode,
    SemanticBlockNode,
    SemanticInlineNode,
} from '../../src/import/semantic-ir.js';

describe('link ref kind normalization', () => {
    it('normalizes dfn, idl, external, unknown, and biblio references', () => {
        const region = parseRegion(`
            <p><a data-link-type="dfn" href="#dfn-term">term</a></p>
            <p><a data-link-type="attribute" href="#dom-example">exampleAttr</a></p>
            <p><a href="https://example.com/spec">external ref</a></p>
            <p><a href="#intro">internal anchor</a></p>
            <p><a data-link-type="biblio" href="#biblio-mcp">[MCP]</a> and [[!RFC2119]]</p>
        `);
        const biblio: BiblioMap = {
            mcp: {
                title: 'Model Context Protocol (MCP) Specification',
                url: 'https://modelcontextprotocol.io/specification/latest',
            },
        };

        const blocks = importNormalizedRegionToIr(region, { biblio });
        const linkRefs = collectLinkRefs(blocks);

        const dfn = findLinkByText(linkRefs, 'term');
        expect(dfn?.kind).toBe('dfn');
        expect(dfn?.linkTypeRaw).toBe('dfn');

        const idl = findLinkByText(linkRefs, 'exampleAttr');
        expect(idl?.kind).toBe('idl');
        expect(idl?.linkTypeRaw).toBe('attribute');

        const external = findLinkByText(linkRefs, 'external ref');
        expect(external?.kind).toBe('external');
        expect(external?.href).toBe('https://example.com/spec');

        const unknown = findLinkByText(linkRefs, 'internal anchor');
        expect(unknown?.kind).toBe('unknown');
        expect(unknown?.href).toBe('#intro');

        const mcp = linkRefs.find((link) => link.citationKey === 'MCP');
        expect(mcp?.kind).toBe('biblio');
        expect(mcp?.href).toBe('#biblio-mcp');
        expect(mcp?.biblioRef?.title).toBe('Model Context Protocol (MCP) Specification');

        const rfc = linkRefs.find((link) => link.citationKey === 'RFC2119');
        expect(rfc?.kind).toBe('biblio');
        expect(rfc?.citationNormative).toBe(true);
        expect(rfc?.href).toBeUndefined();
    });
});

function parseRegion(html: string): Element {
    const root = fromHtml(`<section>${html}</section>`, { fragment: true });
    const section = root.children.find((node): node is Element => node.type === 'element');
    if (!section) {
        throw new Error('Expected section root in test fixture');
    }
    return section;
}

function collectLinkRefs(blocks: SemanticBlockNode[]): LinkRefNode[] {
    const out: LinkRefNode[] = [];

    const visitInline = (inline: SemanticInlineNode): void => {
        if (inline.type === 'LinkRef') {
            out.push(inline);
            inline.children.forEach(visitInline);
            return;
        }
        if (inline.type === 'Definition') {
            inline.children.forEach(visitInline);
        }
    };

    const visitBlock = (block: SemanticBlockNode): void => {
        if (block.type === 'Paragraph') {
            block.children.forEach(visitInline);
            return;
        }
        if (block.type === 'Section') {
            block.heading.forEach(visitInline);
            block.children.forEach(visitBlock);
            return;
        }
        if (
            block.type === 'AlgorithmBlock' ||
            block.type === 'DomIntroBlock' ||
            block.type === 'NoteBlock'
        ) {
            block.children.forEach(visitBlock);
            return;
        }
        if (block.type === 'List') {
            block.items.forEach((item) => item.children.forEach(visitBlock));
            return;
        }
        if (block.type === 'DefinitionList') {
            block.items.forEach((item) => {
                item.term.forEach(visitInline);
                item.description.forEach(visitBlock);
            });
            return;
        }
        if (block.type === 'FigureBlock') {
            block.caption.forEach(visitInline);
            block.children.forEach(visitBlock);
        }
    };

    blocks.forEach(visitBlock);
    return out;
}

function findLinkByText(links: LinkRefNode[], text: string): LinkRefNode | undefined {
    return links.find((link) => inlineText(link.children) === text);
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
