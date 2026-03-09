import { fromHtml } from 'hast-util-from-html';
import { describe, expect, it } from 'vitest';
import type { Element } from 'hast';
import type { BiblioMap } from '../../src/extract/biblio.js';
import { normalizeBikeshedRegion } from '../../src/html/normalize-bikeshed-html.js';
import { importNormalizedRegionToIr } from '../../src/import/html-to-ir.js';
import type {
    CodeSpanNode,
    IdlBlockNode,
    LinkRefNode,
    ParagraphNode,
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
        expect(dfn?.attrs?.dataLinkType).toBe('dfn');

        const idl = findLinkByText(linkRefs, 'exampleAttr');
        expect(idl?.kind).toBe('idl');

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

    it('prunes empty paragraphs from explicit paragraph elements', () => {
        const region = parseRegion(`
            <p>   </p>
            <p>\n\t</p>
            <p>kept paragraph</p>
        `);

        const blocks = importNormalizedRegionToIr(region);
        const paragraphs = blocks.filter((node) => node.type === 'Paragraph');

        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0].children).toEqual([{ type: 'Text', value: 'kept paragraph' }]);
    });

    it('preserves link semantics inside inline code spans', () => {
        const region = parseNormalizedRegion(`
            <p>
                The <code class="idl"><a data-link-type="idl" href="https://example.org/spec#navigator" id="ref-for-navigator" class="idl-code">Navigator</a></code>
                interface references <code class="idl"><a data-link-type="idl" href="#modelcontext" id="ref-for-modelcontext">ModelContext</a></code>.
            </p>
        `);

        const blocks = importNormalizedRegionToIr(region);
        const paragraph = blocks.find((node): node is ParagraphNode => node.type === 'Paragraph');
        expect(paragraph).toBeDefined();

        const codeSpans = (paragraph?.children ?? []).filter(
            (node): node is CodeSpanNode => node.type === 'CodeSpan',
        );
        expect(codeSpans).toHaveLength(2);

        const navigatorCode = codeSpans[0];
        expect(navigatorCode.value).toBe('Navigator');
        const navigatorLink = navigatorCode.children?.find(
            (node): node is LinkRefNode => node.type === 'LinkRef',
        );
        expect(navigatorLink?.kind).toBe('idl');
        expect(navigatorLink?.href).toBe('https://example.org/spec#navigator');
        expect(navigatorLink?.attrs?.dataLinkType).toBe('idl');
        expect(navigatorLink?.attrs?.id).toBe('ref-for-navigator');
        expect(navigatorLink?.attrs?.className).toContain('idl-code');
    });

    it('preserves link semantics in IDL block children', () => {
        const region = parseNormalizedRegion(`
            <pre class="def highlight idl"><c- b="">partial</c-> <c- b="">interface</c-> <a class="idl-code" data-link-type="interface" href="https://html.spec.whatwg.org/multipage/system-state.html#navigator" id="ref-for-navigator"><c- g="">Navigator</c-></a> {
  [<a class="idl-code" data-link-type="extended-attribute" href="https://webidl.spec.whatwg.org/#SecureContext" id="ref-for-SecureContext"><c- g="">SecureContext</c-></a>, <a class="idl-code" data-link-type="extended-attribute" href="https://webidl.spec.whatwg.org/#SameObject" id="ref-for-SameObject"><c- g="">SameObject</c-></a>] <c- b="">readonly</c-> <c- b="">attribute</c-> <a data-link-type="idl-name" href="#modelcontext" id="ref-for-modelcontext"><c- n="">ModelContext</c-></a> <a class="idl-code" data-link-type="attribute" data-readonly="" data-type="ModelContext" href="#dom-navigator-modelcontext" id="ref-for-dom-navigator-modelcontext"><c- g="">modelContext</c-></a>;
};
            </pre>
        `);

        const blocks = importNormalizedRegionToIr(region);
        const idl = blocks.find((node): node is IdlBlockNode => node.type === 'IdlBlock');
        expect(idl).toBeDefined();
        expect(idl?.value).toContain('partial interface Navigator');
        expect(idl?.value).toContain('readonly attribute ModelContext modelContext;');

        const idlLinks = (idl?.children ?? []).filter(
            (node): node is LinkRefNode => node.type === 'LinkRef',
        );
        expect(idlLinks.length).toBeGreaterThan(3);

        const navigator = idlLinks.find((node) => inlineText(node.children) === 'Navigator');
        expect(navigator?.kind).toBe('idl');
        expect(navigator?.href).toContain('#navigator');
        expect(navigator?.attrs?.dataLinkType).toBe('interface');
        expect(navigator?.attrs?.id).toBe('ref-for-navigator');
        expect(navigator?.attrs?.className).toContain('idl-code');

        const modelContextType = idlLinks.find(
            (node) =>
                inlineText(node.children) === 'ModelContext' &&
                node.attrs?.dataLinkType === 'idl-name',
        );
        expect(modelContextType?.kind).toBe('dfn');

        const modelContextMember = idlLinks.find(
            (node) =>
                inlineText(node.children) === 'modelContext' &&
                node.attrs?.dataLinkType === 'attribute',
        );
        expect(modelContextMember?.kind).toBe('idl');
        expect(modelContextMember?.attrs?.id).toBe('ref-for-dom-navigator-modelcontext');
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

function parseNormalizedRegion(html: string): Element {
    return normalizeBikeshedRegion(parseRegion(html));
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
