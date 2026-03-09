import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importBikeshedSpec } from '../src/import-bikeshed-spec.js';
import type { BoilerplateResult } from '../src/boilerplate.js';
import type { BikeshedRenderer } from '../src/renderer/types.js';
import type {
    DocumentNode,
    IdlBlockNode,
    SectionNode,
    SemanticBlockNode,
    SemanticInlineNode,
} from '../src/import/semantic-ir.js';

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const WEBMCP_SOURCE = resolve(PACKAGE_ROOT, 'samples/webmcp/index.bs');
const RENDERED_HTML_FIXTURE = resolve(
    PACKAGE_ROOT,
    'tests/fixtures/webmcp-html-import/rendered.html',
);

let result: Awaited<ReturnType<typeof importBikeshedSpec>>;
let boilerplateMetadataGroup: string | undefined;
let boilerplateMetadataStatus: string | undefined;

beforeAll(async () => {
    const [sourceBs, renderedHtml] = await Promise.all([
        readFile(WEBMCP_SOURCE, 'utf-8'),
        readFile(RENDERED_HTML_FIXTURE, 'utf-8'),
    ]);

    const renderer: BikeshedRenderer = {
        async render() {
            return {
                html: renderedHtml,
                logs: ['fixture renderer used'],
                diagnostics: [],
            };
        },
    };

    result = await importBikeshedSpec(sourceBs, {
        renderer,
        boilerplateResolver: {
            async resolve(metadata) {
                boilerplateMetadataGroup = valueAsString(metadata.get('group'));
                boilerplateMetadataStatus = valueAsString(metadata.get('status'));
                const resolved: BoilerplateResult = {
                    abstract: {
                        content: '<section id="abstract"><h2 class="no-num no-toc no-ref" id="abstract">Abstract</h2><p>[ABSTRACT]</p></section>',
                        source: 'fixture://abstract',
                    },
                    status: {
                        content: '<section id="status"><h2>Status of This Document</h2><p>Status boilerplate slot</p><p>[STATUSTEXT]</p></section>',
                        source: 'fixture://status',
                    },
                    conformance: {
                        content: '<div><h2 id="conformance">Conformance</h2><p>Conformance requirements stay around their context. [[!MCP]] and [[!RFC2119]]</p></div>',
                        source: 'fixture://conformance',
                    },
                    copyright: {
                        content: '<p>Copyright OpenUJI WG.</p>',
                        source: 'fixture://copyright',
                    },
                    logo: {
                        content: '<a class=\"logo\" href=\"https://example.org\"><img src=\"https://example.org/logo.svg\" alt=\"OpenUJI\"></a>',
                        source: 'fixture://logo',
                    },
                };
                return resolved;
            },
        },
    });
});

describe('importBikeshedSpec source extractors', () => {
    it('extracts metadata and biblio from source .bs', () => {
        expect(result.metadata.get('shortname')).toBe('webmcp');
        expect(result.metadata.get('group')).toBe('webml');
        expect(result.biblio['mcp']).toBeDefined();
    });

    it('extracts style/script resources independently from markdown pipeline', () => {
        const styleBlocks = result.resources.filter((item) => item.type === 'style');
        expect(styleBlocks.length).toBeGreaterThan(0);
        expect(styleBlocks[0].content).toContain('.domintro');
    });

    it('integrates boilerplate resolver using metadata-derived group/status', () => {
        expect(boilerplateMetadataGroup).toBe('webml');
        expect(boilerplateMetadataStatus).toBe('CG-DRAFT');
        expect(result.boilerplate.abstract?.source).toBe('fixture://abstract');
        expect(result.boilerplate.status?.source).toBe('fixture://status');
        expect(result.boilerplate.conformance?.source).toBe('fixture://conformance');
    });

    it('enriches config.custom with boilerplate copyright and logo', () => {
        expect(result.config.custom.copyright).toBe('<p>Copyright OpenUJI WG.</p>');
        expect(result.config.custom.logo).toEqual({
            href: 'https://example.org',
            src: 'https://example.org/logo.svg',
            alt: 'OpenUJI',
        });
    });
});

describe('rendered HTML region selection + normalization', () => {
    it('captures selected regions (main, abstract, status)', () => {
        expect(result.regions.main.selectedHtml).toMatchSnapshot('selected-main');
        expect(result.regions.abstract?.selectedHtml ?? '').toMatchSnapshot('selected-abstract');
        expect(result.regions.status?.selectedHtml ?? '').toMatchSnapshot('selected-status');
    });

    it('normalizes selected regions and strips generated chrome', () => {
        expect(result.regions.main.normalizedHtml).toMatchSnapshot('normalized-main');
        expect(result.regions.abstract?.normalizedHtml ?? '').toMatchSnapshot('normalized-abstract');
        expect(result.regions.status?.normalizedHtml ?? '').toMatchSnapshot('normalized-status');

        expect(result.regions.main.normalizedHtml).not.toContain('self-link');
        expect(result.regions.main.normalizedHtml).not.toContain('<script');
        expect(result.regions.main.normalizedHtml).not.toContain('IDL Index');
        expect(result.regions.main.normalizedHtml).not.toContain('References');
    });
});

describe('semantic importer (HTML -> IR)', () => {
    it('imports main region into a semantic document IR snapshot', () => {
        expect(JSON.stringify(result.document, null, 2)).toMatchSnapshot('document-ir');
    });

    it('includes required semantic node families', () => {
        const blocks = flattenBlocks(result.document);

        expect(blocks.some((node) => node.type === 'IdlBlock')).toBe(true);
        expect(blocks.some((node) => node.type === 'AlgorithmBlock')).toBe(true);
        expect(blocks.some((node) => node.type === 'DomIntroBlock')).toBe(true);
        expect(blocks.some((node) => node.type === 'NoteBlock')).toBe(true);

        const definitions = flattenInlines(result.document).filter(
            (node) => node.type === 'Definition',
        );
        expect(definitions.length).toBeGreaterThan(0);

        const linkRefs = flattenInlines(result.document).filter(
            (node) => node.type === 'LinkRef',
        );
        expect(
            linkRefs.some((node) => node.type === 'LinkRef' && node.kind === 'dfn'),
        ).toBe(true);
        expect(
            linkRefs.some((node) => node.type === 'LinkRef' && node.attrs?.dataLinkType === 'dfn'),
        ).toBe(true);

        const idlBlock = blocks.find((node): node is IdlBlockNode => node.type === 'IdlBlock');
        expect(idlBlock).toBeDefined();
        expect((idlBlock?.children ?? []).length).toBeGreaterThan(0);
    });

    it('imports abstract/status region blocks', () => {
        expect(JSON.stringify(result.regions.abstract?.blocks ?? [], null, 2)).toMatchSnapshot(
            'abstract-blocks-ir',
        );
        expect(JSON.stringify(result.regions.status?.blocks ?? [], null, 2)).toMatchSnapshot(
            'status-blocks-ir',
        );
        expect(JSON.stringify(result.regions.conformance?.blocks ?? [], null, 2)).toMatchSnapshot(
            'conformance-blocks-ir',
        );
    });

    it('does not emit empty paragraph nodes', () => {
        expect(hasEmptyParagraphNodes(result.document.children as SemanticBlockNode[])).toBe(false);
        expect(hasEmptyParagraphNodes(result.regions.abstract?.blocks ?? [])).toBe(false);
        expect(hasEmptyParagraphNodes(result.regions.status?.blocks ?? [])).toBe(false);
        expect(hasEmptyParagraphNodes(result.regions.conformance?.blocks ?? [])).toBe(false);
    });

    it('converts boilerplate citation shorthand into semantic biblio references', () => {
        const conformanceText = JSON.stringify(result.regions.conformance?.blocks ?? [], null, 2);
        expect(conformanceText).toContain('"citationKey": "MCP"');
        expect(conformanceText).toContain('"citationNormative": true');
        expect(conformanceText).toContain('"href": "#biblio-mcp"');
        expect(conformanceText).toContain('"title": "Model Context Protocol (MCP) Specification"');

        expect(conformanceText).toContain('"citationKey": "RFC2119"');
        expect(conformanceText).not.toContain('"href": "#biblio-rfc2119"');
    });

    it('marks/injects boilerplate sections in semantic IR', () => {
        const topSections = result.document.children.filter(
            (node): node is SectionNode => node.type === 'Section',
        );
        const kinds = topSections
            .map((section) => section.boilerplate)
            .filter((value): value is 'abstract' | 'sotd' | 'conformance' => !!value);

        expect(kinds).toContain('abstract');
        expect(kinds).toContain('sotd');
        expect(kinds).toContain('conformance');

        const abstractSection = topSections.find((section) => section.boilerplate === 'abstract');
        const sotdSection = topSections.find((section) => section.boilerplate === 'sotd');
        expect(JSON.stringify(abstractSection, null, 2)).toContain(
            'The WebMCP API enables web applications to provide JavaScript-based tools to AI agents.',
        );
        expect(JSON.stringify(sotdSection, null, 2)).toContain('Status boilerplate slot');
        expect(JSON.stringify(sotdSection, null, 2)).not.toContain('[STATUSTEXT]');

        const conformanceSection = topSections.find(
            (section) => section.boilerplate === 'conformance',
        );
        expect(conformanceSection?.omitted).toBe(true);
    });
});

function flattenBlocks(document: DocumentNode): SemanticBlockNode[] {
    const out: SemanticBlockNode[] = [];

    const visitBlock = (node: SemanticBlockNode): void => {
        out.push(node);

        if (node.type === 'Section') {
            node.children.forEach(visitBlock);
            return;
        }

        if (
            node.type === 'AlgorithmBlock' ||
            node.type === 'DomIntroBlock' ||
            node.type === 'NoteBlock'
        ) {
            node.children.forEach(visitBlock);
            return;
        }

        if (node.type === 'List') {
            node.items.forEach((item) => item.children.forEach(visitBlock));
            return;
        }

        if (node.type === 'ListItem') {
            node.children.forEach(visitBlock);
            return;
        }

        if (node.type === 'DefinitionList') {
            node.items.forEach((item) => item.description.forEach(visitBlock));
        }
    };

    document.children.forEach((node) => {
        if (node.type === 'Section') {
            visitBlock(node);
        } else {
            visitBlock(node as SemanticBlockNode);
        }
    });

    return out;
}

function flattenInlines(document: DocumentNode): SemanticInlineNode[] {
    const out: SemanticInlineNode[] = [];

    const visitInline = (node: SemanticInlineNode): void => {
        out.push(node);
        if (node.type === 'Definition' || node.type === 'LinkRef') {
            node.children.forEach(visitInline);
            return;
        }
        if (node.type === 'CodeSpan' && node.children) {
            node.children.forEach(visitInline);
        }
    };

    const visitBlock = (node: SemanticBlockNode): void => {
        if (node.type === 'Paragraph') {
            node.children.forEach(visitInline);
            return;
        }

        if (node.type === 'Section') {
            node.heading.forEach(visitInline);
            node.children.forEach(visitBlock);
            return;
        }

        if (node.type === 'AlgorithmBlock' || node.type === 'DomIntroBlock' || node.type === 'NoteBlock') {
            node.children.forEach(visitBlock);
            return;
        }

        if (node.type === 'DefinitionList') {
            node.items.forEach((item) => {
                item.term.forEach(visitInline);
                item.description.forEach(visitBlock);
            });
            return;
        }

        if (node.type === 'List') {
            node.items.forEach((item) => item.children.forEach(visitBlock));
        }
    };

    for (const child of document.children) {
        visitBlock(child as SectionNode);
    }

    return out;
}

function valueAsString(value: string | string[] | undefined): string | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value[0];
    return value;
}

function hasEmptyParagraphNodes(blocks: SemanticBlockNode[]): boolean {
    const visit = (node: SemanticBlockNode): boolean => {
        if (node.type === 'Paragraph') {
            return node.children.length === 0;
        }

        if (
            node.type === 'Section' ||
            node.type === 'AlgorithmBlock' ||
            node.type === 'DomIntroBlock' ||
            node.type === 'NoteBlock'
        ) {
            return node.children.some(visit);
        }

        if (node.type === 'FigureBlock') {
            return node.children.some(visit);
        }

        if (node.type === 'List') {
            return node.items.some((item) => item.children.some(visit));
        }

        if (node.type === 'ListItem') {
            return node.children.some(visit);
        }

        if (node.type === 'DefinitionList') {
            return node.items.some((item) => item.description.some(visit));
        }

        return false;
    };

    return blocks.some(visit);
}
