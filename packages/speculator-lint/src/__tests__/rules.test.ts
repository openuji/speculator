import { describe, it, expect } from 'vitest';
import { SpeculatorLinter } from '../linter.js';
import { builtInRules } from '../rules/index.js';
import { recommendedConfig } from '../config.js';
import type { Workspace, Document } from '@openuji/speculator';

function createMockWorkspace(docs: Document[]): Workspace {
    return {
        type: 'workspace',
        documents: docs,
        schemaVersion: '1.1.0'
    };
}

describe('Speculator Lint Rules', () => {
    const linter = new SpeculatorLinter(builtInRules);

    describe('document/no-duplicate-definition', () => {
        it('reports error when a document has duplicate definitions', async () => {
            const doc: Document = {
                type: 'document',
                id: 'doc-1',
                sourcePos: { file: 'doc-1.md', line: 1, column: 1 },
                children: [],
                indexes: {
                    definitions: [
                        { term: 'Duplicate', id: 'dfn-1', sourcePos: { file: 'doc-1.md', line: 5, column: 1 } },
                        { term: 'duplicate', id: 'dfn-2', sourcePos: { file: 'doc-1.md', line: 10, column: 1 } }
                    ]
                }
            };

            const workspace = createMockWorkspace([doc]);
            const documentLevels = new Map([['doc-1.md', 0]]);

            const result = await linter.lint({
                workspace,
                documentLevels,
                config: recommendedConfig
            });

            const diagnostics = result.diagnostics.filter(d => d.code === 'no-duplicate-definition');
            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].message).toContain('Duplicate definition of term/alias "duplicate"');
        });

        it('reports error when a document has duplicate linkTexts', async () => {
            const doc: Document = {
                type: 'document',
                id: 'doc-1',
                sourcePos: { file: 'doc-1.md', line: 1, column: 1 },
                children: [],
                indexes: {
                    definitions: [
                        { term: 'Term A', id: 'dfn-1', linkTexts: ['alias'], sourcePos: { file: 'doc-1.md', line: 5, column: 1 } },
                        { term: 'Term B', id: 'dfn-2', linkTexts: ['Alias'], sourcePos: { file: 'doc-1.md', line: 10, column: 1 } }
                    ]
                }
            };

            const workspace = createMockWorkspace([doc]);
            const documentLevels = new Map([['doc-1.md', 0]]);

            const result = await linter.lint({
                workspace,
                documentLevels,
                config: recommendedConfig
            });

            const diagnostics = result.diagnostics.filter(d => d.code === 'no-duplicate-definition');
            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].message).toContain('Duplicate definition of term/alias "Alias"');
        });

        it('does NOT report error when same term has different contexts', async () => {
            const doc: Document = {
                type: 'document',
                id: 'doc-1',
                sourcePos: { file: 'doc-1.md', line: 1, column: 1 },
                children: [],
                indexes: {
                    definitions: [
                        { term: 'Ambiguous', id: 'dfn-1', forContexts: ['Context1'], sourcePos: { file: 'doc-1.md', line: 5, column: 1 } },
                        { term: 'Ambiguous', id: 'dfn-2', forContexts: ['Context2'], sourcePos: { file: 'doc-1.md', line: 10, column: 1 } }
                    ]
                }
            };

            const workspace = createMockWorkspace([doc]);
            const documentLevels = new Map([['doc-1.md', 0]]);

            const result = await linter.lint({
                workspace,
                documentLevels,
                config: recommendedConfig
            });

            const diagnostics = result.diagnostics.filter(d => d.code === 'no-duplicate-definition');
            expect(diagnostics).toHaveLength(0);
        });
    });


    describe('workspace/no-redefinition', () => {
        it('reports error when lower level spec redefines term from higher level spec', async () => {
            const docA: Document = {
                type: 'document',
                id: 'doc-a',
                sourcePos: { file: 'doc-a.md', line: 1, column: 1 },
                children: [],
                indexes: {
                    definitions: [
                        { term: 'BaseTerm', id: 'dfn-base', sourcePos: { file: 'doc-a.md', line: 5, column: 1 } }
                    ]
                }
            };

            const docB: Document = {
                type: 'document',
                id: 'doc-b',
                sourcePos: { file: 'doc-b.md', line: 1, column: 1 },
                children: [],
                indexes: {
                    definitions: [
                        { term: 'BaseTerm', id: 'dfn-redefined', sourcePos: { file: 'doc-b.md', line: 10, column: 1 } }
                    ]
                }
            };

            const workspace = createMockWorkspace([docA, docB]);
            const documentLevels = new Map([['doc-a.md', 0], ['doc-b.md', 1]]);

            const result = await linter.lint({
                workspace,
                documentLevels,
                config: recommendedConfig
            });

            const diagnostics = result.diagnostics.filter(d => d.code === 'no-redefinition');
            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].message).toContain('redefines concept "BaseTerm" already defined in higher-level spec "doc-a.md"');
        });
    });

    describe('workspace/no-reverse-dependency', () => {
        it('reports error when higher-level spec references lower-level spec', async () => {
            const docA: Document = {
                type: 'document',
                id: 'doc-a',
                sourcePos: { file: 'doc-a.md', line: 1, column: 1 },
                children: [
                    {
                        type: 'paragraph',
                        children: [
                            { type: 'workspaceDfnReference', targetTerm: 'LowerTerm', targetId: 'dfn-lower', children: [] }
                        ]
                    } as any
                ],
                indexes: {
                    definitions: []
                }
            };

            const docB: Document = {
                type: 'document',
                id: 'doc-b',
                sourcePos: { file: 'doc-b.md', line: 1, column: 1 },
                children: [],
                indexes: {
                    definitions: [
                        { term: 'LowerTerm', id: 'dfn-lower', sourcePos: { file: 'doc-b.md', line: 5, column: 1 } }
                    ]
                }
            };

            const workspace = createMockWorkspace([docA, docB]);
            const documentLevels = new Map([['doc-a.md', 0], ['doc-b.md', 1]]);

            const result = await linter.lint({
                workspace,
                documentLevels,
                config: recommendedConfig
            });

            const diagnostics = result.diagnostics.filter(d => d.code === 'no-reverse-dependency');
            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].message).toContain('Higher-level spec "doc-a.md" (level 0) depends on lower-level spec "doc-b.md" (level 1)');
        });
    });
});
