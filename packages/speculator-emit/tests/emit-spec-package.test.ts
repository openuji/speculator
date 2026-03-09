import { describe, expect, it } from 'vitest';
import type { SpecConfig, SpeculatorASTSchema } from '@openuji/speculator';
import { emitSpecPackage } from '../src/emit-spec-package.js';

function createConfig(): SpecConfig {
    return {
        id: 'sample-spec',
        deps: [],
        specIri: 'https://example.com/sample-spec',
        title: 'Sample Spec',
        shortName: 'sample',
        status: 'CG-DRAFT',
        group: 'samplecg',
        lastUpdateDate: '[DATE]',
        localBiblio: {
            RFC2119: {
                title: 'Key words for use in RFCs to Indicate Requirement Levels',
                url: 'https://www.rfc-editor.org/rfc/rfc2119',
            },
        },
    };
}

function createWorkspace(): SpeculatorASTSchema {
    return {
        type: 'workspace',
        schemaVersion: '1.1.0',
        documents: [
            {
                type: 'document',
                id: 'sample-spec',
                children: [
                    {
                        type: 'section',
                        id: 'intro',
                        number: '1',
                        heading: {
                            type: 'heading',
                            depth: 2,
                            id: 'intro',
                            children: [{ type: 'text', value: 'Introduction' }],
                        },
                        children: [
                            {
                                type: 'paragraph',
                                children: [
                                    { type: 'text', value: 'The ' },
                                    {
                                        type: 'inlineCode',
                                        value: 'Navigator',
                                        children: [
                                            {
                                                type: 'workspaceIdlReference',
                                                targetTerm: 'Navigator',
                                                children: [{ type: 'text', value: 'Navigator' }],
                                                source: {
                                                    kind: 'idl',
                                                    dataLinkType: 'idl',
                                                    href: '#navigator',
                                                },
                                            },
                                        ],
                                    },
                                    { type: 'text', value: ' interface extends ' },
                                    {
                                        type: 'definition',
                                        term: 'agent',
                                        dfnType: 'dfn',
                                        children: [{ type: 'text', value: 'agent' }],
                                    },
                                    { type: 'text', value: ' and follows ' },
                                    {
                                        type: 'cite',
                                        key: 'RFC2119',
                                        forcedNormative: true,
                                        kind: 'normative',
                                    },
                                    { type: 'text', value: '.' },
                                ],
                            },
                            {
                                type: 'idl',
                                value: 'partial interface Navigator {\n  readonly attribute ModelContext modelContext;\n};',
                                children: [
                                    { type: 'text', value: 'partial interface ' },
                                    {
                                        type: 'workspaceIdlReference',
                                        targetTerm: 'Navigator',
                                        children: [{ type: 'text', value: 'Navigator' }],
                                        source: { kind: 'idl', dataLinkType: 'interface' },
                                    },
                                    { type: 'text', value: ' {\n  readonly attribute ' },
                                    {
                                        type: 'workspaceIdlReference',
                                        targetTerm: 'ModelContext',
                                        children: [{ type: 'text', value: 'ModelContext' }],
                                        source: { kind: 'idl', dataLinkType: 'idl-name' },
                                    },
                                    { type: 'text', value: ' ' },
                                    {
                                        type: 'definition',
                                        term: 'Navigator/modelContext',
                                        dfnType: 'attribute',
                                        children: [{ type: 'text', value: 'modelContext' }],
                                    },
                                    { type: 'text', value: ';\n};' },
                                ],
                            },
                            {
                                type: 'definitionList',
                                items: [
                                    {
                                        term: [{ type: 'text', value: 'Foo' }],
                                        description: [
                                            {
                                                type: 'paragraph',
                                                children: [{ type: 'text', value: 'Bar' }],
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                type: 'algorithm',
                                children: [
                                    {
                                        type: 'paragraph',
                                        children: [{ type: 'text', value: 'Run steps.' }],
                                    },
                                ],
                            },
                            {
                                type: 'domIntro',
                                children: [
                                    {
                                        type: 'paragraph',
                                        children: [{ type: 'text', value: 'DOM intro text.' }],
                                    },
                                ],
                            },
                            {
                                type: 'figure',
                                id: 'fig-1',
                                image: {
                                    srcOriginal: 'sequence.mmd.svg',
                                    srcResolved: 'sequence.mmd',
                                    generatedFrom: 'mermaid-mmd',
                                    exists: true,
                                    alt: 'Flow',
                                },
                                caption: [{ type: 'text', value: 'Flow caption' }],
                                children: [],
                            },
                            {
                                type: 'imageAsset',
                                asset: {
                                    srcOriginal: 'diagram.svg',
                                    alt: 'Diagram',
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

describe('emitSpecPackage', () => {
    it('emits deterministic index.md + canonical config.json snapshots', () => {
        const result = emitSpecPackage({
            workspace: createWorkspace(),
            config: createConfig(),
        });

        expect(result.indexMd).toMatchSnapshot('index-md');
        expect(result.configJson).toMatchSnapshot('config-json');
        expect(result.diagnostics).toMatchSnapshot('diagnostics');
    });

    it('emits fallback diagnostics for unsupported inline shapes', () => {
        const workspace: SpeculatorASTSchema = {
            type: 'workspace',
            schemaVersion: '1.1.0',
            documents: [
                {
                    type: 'document',
                    id: 'diag-doc',
                    children: [
                        {
                            type: 'paragraph',
                            children: [
                                { type: 'text', value: 'Normative keyword: ' },
                                { type: 'requirement', keyword: 'MUST' },
                                { type: 'text', value: '; issue: ' },
                                { type: 'issue', id: '123' },
                            ],
                        },
                    ],
                },
            ],
        };

        const config: SpecConfig = {
            id: 'diag-doc',
            deps: [],
            specIri: 'diag-doc',
        };

        const result = emitSpecPackage({
            workspace,
            config,
        });

        expect(result.diagnostics).toEqual([
            {
                level: 'warning',
                code: 'INLINE_REQUIREMENT_FALLBACK',
                message: 'Inline requirement node serialized as plain text fallback.',
                path: 'document.children[0].children[1]',
            },
            {
                level: 'warning',
                code: 'INLINE_ISSUE_FALLBACK',
                message: 'Inline issue node serialized as plain text fallback.',
                path: 'document.children[0].children[3]',
            },
        ]);
    });

    it('emits heading attr block flags for noToc/noTocCount sections', () => {
        const workspace: SpeculatorASTSchema = {
            type: 'workspace',
            schemaVersion: '1.1.0',
            documents: [
                {
                    type: 'document',
                    id: 'toc-flags',
                    children: [
                        {
                            type: 'section',
                            id: 'hidden-section',
                            noToc: true,
                            noTocCount: true,
                            heading: {
                                type: 'heading',
                                depth: 2,
                                id: 'hidden-section',
                                children: [{ type: 'text', value: 'Hidden' }],
                                noToc: true,
                                noTocCount: true,
                            },
                            children: [],
                        },
                    ],
                },
            ],
        };

        const config: SpecConfig = {
            id: 'toc-flags',
            deps: [],
            specIri: 'toc-flags',
        };

        const result = emitSpecPackage({ workspace, config });
        expect(result.indexMd).toContain('data-no-toc');
        expect(result.indexMd).not.toContain('data-no-toc-count');
    });

    it('emits local dfn refs and cites as markdown shorthands while keeping external semantic dfn anchors', () => {
        const workspace: SpeculatorASTSchema = {
            type: 'workspace',
            schemaVersion: '1.1.0',
            documents: [
                {
                    type: 'document',
                    id: 'shorthand-doc',
                    children: [
                        {
                            type: 'paragraph',
                            children: [
                                {
                                    type: 'workspaceDfnReference',
                                    targetTerm: 'agents',
                                    targetId: 'agent',
                                    children: [{ type: 'text', value: 'agents' }],
                                },
                                { type: 'text', value: ', ' },
                                {
                                    type: 'workspaceDfnReference',
                                    targetTerm: 'browser’s agents',
                                    targetId: 'browsers-agent',
                                    children: [{ type: 'text', value: 'browser’s agents' }],
                                },
                                { type: 'text', value: ', and ' },
                                {
                                    type: 'externalDfnReference',
                                    targetTerm: 'assistive technologies',
                                    xrefSpec: 'aria',
                                    url: 'https://w3c.github.io/aria/#assistive-technology',
                                    children: [{ type: 'text', value: 'assistive technologies' }],
                                    source: {
                                        kind: 'dfn',
                                        dataLinkType: 'dfn',
                                    },
                                },
                                { type: 'text', value: '; cite: ' },
                                {
                                    type: 'cite',
                                    key: 'MCP',
                                    children: [{ type: 'text', value: '[MCP]' }],
                                    targetId: 'biblio-mcp',
                                    url: 'https://modelcontextprotocol.io/specification/latest',
                                    source: {
                                        kind: 'biblio',
                                        dataLinkType: 'biblio',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const config: SpecConfig = {
            id: 'shorthand-doc',
            deps: [],
            specIri: 'shorthand-doc',
        };

        const result = emitSpecPackage({ workspace, config });

        expect(result.indexMd).toContain('[=agent=]');
        expect(result.indexMd).toContain('[=browsers-agent|browser’s agents=]');
        expect(result.indexMd).toContain(
            '<a data-link-type="dfn" data-xref-spec="aria" href="https://w3c.github.io/aria/#assistive-technology">assistive technologies</a>',
        );
        expect(result.indexMd).toContain('[[MCP]]');
        expect(result.indexMd).not.toContain('<a data-cite=');
    });
});
